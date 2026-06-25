import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { FB_GRAPH } from "../_shared/fb.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub;

    const { id } = await req.json();
    if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row, error } = await admin.from("fb_pages").select("*").eq("id", id).maybeSingle();
    if (error || !row) return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (row.user_id !== userId) {
      const { data: canManage } = await admin.rpc("user_can_manage_page", { _page_id: id });
      // Fallback: check page_members directly with service role
      let allowed = !!canManage;
      if (!allowed) {
        const { data: member } = await admin.from("page_members").select("role").eq("page_id", id).eq("user_id", userId).maybeSingle();
        allowed = member?.role === "owner" || member?.role === "full";
      }
      if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Best-effort unsubscribe from FB webhooks
    if (row.page_access_token) {
      try {
        await fetch(`${FB_GRAPH}/${row.fb_page_id}/subscribed_apps?access_token=${encodeURIComponent(row.page_access_token)}`, { method: "DELETE" });
      } catch (_) { /* ignore */ }
    }

    // Hard delete: fully remove the page and all related data (ON DELETE CASCADE on fb_page_id columns).
    // Reconnecting later will create a fresh page row.
    const { error: delErr } = await admin.from("fb_pages").delete().eq("id", id);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, deleted: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
