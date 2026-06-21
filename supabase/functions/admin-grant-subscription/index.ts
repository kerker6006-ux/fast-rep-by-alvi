import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const admin = createClient(url, service);
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const body = await req.json();
    const { user_id, mode, days, until, plan, note } = body as {
      user_id: string;
      mode: "grant" | "revoke";
      days?: number;
      until?: string;
      plan?: string;
      note?: string;
    };
    if (!user_id || !mode) {
      return new Response(JSON.stringify({ error: "Missing user_id or mode" }), { status: 400, headers: corsHeaders });
    }

    if (mode === "revoke") {
      await admin.from("profiles").update({
        subscription_status: "canceled",
        subscription_plan: null,
        subscription_current_period_end: null,
      }).eq("id", user_id);
      await admin.from("admin_audit_log").insert({
        admin_id: user.id, action: "revoke_subscription", target_user: user_id, meta: { note: note ?? null },
      });
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let endDate: Date;
    if (until) {
      endDate = new Date(until);
    } else if (typeof days === "number" && days > 0) {
      endDate = new Date(Date.now() + days * 86400000);
    } else {
      return new Response(JSON.stringify({ error: "Provide days or until" }), { status: 400, headers: corsHeaders });
    }
    if (isNaN(endDate.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid date" }), { status: 400, headers: corsHeaders });
    }

    await admin.from("profiles").update({
      subscription_status: "active",
      subscription_plan: plan ?? "admin_grant",
      subscription_current_period_end: endDate.toISOString(),
      free_until: endDate.toISOString(),
    }).eq("id", user_id);

    await admin.from("admin_audit_log").insert({
      admin_id: user.id,
      action: "grant_subscription",
      target_user: user_id,
      meta: { until: endDate.toISOString(), plan: plan ?? "admin_grant", note: note ?? null },
    });

    return new Response(JSON.stringify({ ok: true, until: endDate.toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
