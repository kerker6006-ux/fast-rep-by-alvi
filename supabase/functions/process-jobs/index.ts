// Background worker — picks pending jobs from job_queue and executes by type.
// Triggered by pg_cron every minute (or manually via HTTP).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 25;
const STUCK_MINUTES = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require service-role bearer token (pg_cron / internal callers only)
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (!token || token !== serviceKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Requeue stuck jobs
  const stuckCutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000).toISOString();
  await supabase
    .from("job_queue")
    .update({ status: "pending", started_at: null })
    .eq("status", "processing")
    .lt("started_at", stuckCutoff);

  // Pick ready jobs
  const { data: jobs, error } = await supabase
    .from("job_queue")
    .select("*")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .order("run_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
  if (!jobs?.length) {
    return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results = { processed: 0, failed: 0 };

  for (const job of jobs) {
    // Mark processing
    const { data: claimed } = await supabase
      .from("job_queue")
      .update({ status: "processing", started_at: new Date().toISOString(), attempts: job.attempts + 1 })
      .eq("id", job.id)
      .eq("status", "pending")
      .select()
      .maybeSingle();
    if (!claimed) continue; // another worker grabbed it

    try {
      await runJob(supabase, job);
      await supabase.from("job_queue").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", job.id);
      results.processed++;
    } catch (e: any) {
      const errMsg = e?.message || String(e);
      console.error(`Job ${job.id} (${job.type}) failed:`, errMsg);
      const willRetry = job.attempts + 1 < job.max_attempts;
      const backoffMin = Math.pow(2, job.attempts); // 1, 2, 4 min
      await supabase.from("job_queue").update({
        status: willRetry ? "pending" : "failed",
        run_at: willRetry ? new Date(Date.now() + backoffMin * 60 * 1000).toISOString() : job.run_at,
        last_error: errMsg.slice(0, 1000),
        started_at: null,
      }).eq("id", job.id);
      results.failed++;
      if (!willRetry) {
        await supabase.from("webhook_failures").insert({
          source: `job:${job.type}`,
          user_id: job.user_id,
          payload: job.payload,
          error: errMsg,
          retry_count: job.attempts + 1,
        });
      }
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function runJob(supabase: any, job: any) {
  switch (job.type) {
    case "send_dm":
      return await sendDm(supabase, job);
    case "ping":
      return; // healthcheck
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

async function sendDm(supabase: any, job: any) {
  const { recipient_id, page_id, text, image_url, user_id } = job.payload;
  const { data: page } = await supabase
    .from("fb_pages")
    .select("page_access_token")
    .eq("user_id", user_id)
    .eq("page_id", page_id)
    .maybeSingle();
  const pat = page?.page_access_token || Deno.env.get("FB_PAGE_ACCESS_TOKEN");
  if (!pat) throw new Error("No page access token");

  const payload: any = { recipient: { id: recipient_id }, messaging_type: "RESPONSE" };
  payload.message = image_url
    ? { attachment: { type: "image", payload: { url: image_url, is_reusable: true } } }
    : { text };

  const resp = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${pat}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json.error?.message || `FB ${resp.status}`);
  return json;
}
