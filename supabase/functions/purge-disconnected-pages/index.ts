import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Hard-deletes fb_pages whose 7-day grace has expired.
// ON DELETE CASCADE on fb_page_id columns purges related products/orders/conversations/etc.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: expired, error } = await admin
    .from("fb_pages")
    .select("id, fb_page_id, page_name")
    .lt("pending_delete_at", new Date().toISOString())
    .not("pending_delete_at", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!expired?.length) {
    return new Response(JSON.stringify({ purged: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const ids = expired.map((r) => r.id);
  const { error: delErr } = await admin.from("fb_pages").delete().in("id", ids);
  if (delErr) {
    return new Response(JSON.stringify({ error: delErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ purged: ids.length, pages: expired }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
