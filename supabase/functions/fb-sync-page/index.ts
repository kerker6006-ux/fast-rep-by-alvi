import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { FB_GRAPH, SUBSCRIBED_FIELDS } from "../_shared/fb.ts";

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
    const { data: row } = await admin.from("fb_pages").select("*").eq("id", id).maybeSingle();
    if (!row || row.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!row.page_access_token) {
      return new Response(JSON.stringify({ error: "No token. Reconnect this page." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Refresh page info
    let pageName = row.page_name;
    let picture: string | null = row.page_picture_url ?? null;
    try {
      const infoRes = await fetch(`${FB_GRAPH}/${row.fb_page_id}?fields=id,name,picture{url}&access_token=${encodeURIComponent(row.page_access_token)}`);
      const infoJson = await infoRes.json();
      if (infoRes.ok) {
        pageName = infoJson.name ?? pageName;
        picture = infoJson.picture?.data?.url ?? picture;
      }
    } catch (_) { /* ignore */ }

    // Re-subscribe
    let subStatus = "active";
    let subError: string | null = null;
    try {
      const subRes = await fetch(`${FB_GRAPH}/${row.fb_page_id}/subscribed_apps`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ subscribed_fields: SUBSCRIBED_FIELDS.join(","), access_token: row.page_access_token }),
      });
      const subJson = await subRes.json();
      if (!subRes.ok || subJson.success === false) {
        subStatus = "failed";
        subError = subJson.error?.message ?? "Subscription failed";
      }
    } catch (e) {
      subStatus = "failed";
      subError = (e as Error).message;
    }

    await admin.from("fb_pages").update({
      page_name: pageName,
      page_picture_url: picture,
      is_active: subStatus === "active",
      last_sync_at: new Date().toISOString(),
      subscription_status: subStatus,
      subscription_error: subError,
      subscribed_fields: subStatus === "active" ? SUBSCRIBED_FIELDS : [],
      disconnected_at: subStatus === "active" ? null : row.disconnected_at,
    }).eq("id", id);

    return new Response(JSON.stringify({ ok: true, status: subStatus, error: subError }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
