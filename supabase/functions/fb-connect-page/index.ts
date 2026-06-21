import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { FB_GRAPH, SUBSCRIBED_FIELDS, IG_SUBSCRIBED_FIELDS } from "../_shared/fb.ts";

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

    const { session_token, page_id } = await req.json();
    if (!session_token || !page_id) {
      return new Response(JSON.stringify({ error: "session_token and page_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: sess, error: sErr } = await admin
      .from("fb_oauth_sessions")
      .select("*")
      .eq("session_token", session_token)
      .maybeSingle();
    if (sErr || !sess) return new Response(JSON.stringify({ error: "Session not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (sess.user_id !== userId) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const page = (sess.pages as any[]).find((p) => p.id === page_id);
    if (!page) return new Response(JSON.stringify({ error: "Page not in session" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Check for an existing row (soft-disconnected or active). Reconnect within 7 days restores history.
    const { data: existing } = await admin
      .from("fb_pages")
      .select("id, page_category, pending_delete_at")
      .eq("fb_page_id", page.id)
      .maybeSingle();

    // Subscribe page to webhooks
    let subStatus = "active";
    let subError: string | null = null;
    let subscribed: string[] = SUBSCRIBED_FIELDS;
    try {
      const subRes = await fetch(`${FB_GRAPH}/${page.id}/subscribed_apps`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          subscribed_fields: SUBSCRIBED_FIELDS.join(","),
          access_token: page.access_token,
        }),
      });
      const subJson = await subRes.json();
      if (!subRes.ok || subJson.success === false) {
        subStatus = "failed";
        subError = subJson.error?.message ?? "Subscription failed";
        subscribed = [];
      }
    } catch (e) {
      subStatus = "failed";
      subError = (e as Error).message;
      subscribed = [];
    }

    let igSubStatus: string | null = null;
    if (page.ig_business_account_id) {
      try {
        const igRes = await fetch(`${FB_GRAPH}/${page.ig_business_account_id}/subscribed_apps`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            subscribed_fields: IG_SUBSCRIBED_FIELDS.join(","),
            access_token: page.access_token,
          }),
        });
        const igJson = await igRes.json();
        igSubStatus = igRes.ok && igJson.success !== false ? "active" : `failed: ${igJson.error?.message ?? "unknown"}`;
      } catch (e) {
        igSubStatus = `failed: ${(e as Error).message}`;
      }
    }

    // Restored reconnect: keep existing category so user doesn't re-pick.
    // Fresh connect (or category was never set): clear category so frontend prompts user.
    const restoredCategory = existing?.page_category ?? null;

    const { error: upErr } = await admin
      .from("fb_pages")
      .upsert(
        {
          user_id: userId,
          fb_page_id: page.id,
          page_name: page.name,
          page_access_token: page.access_token,
          page_picture_url: page.picture_url,
          is_active: subStatus === "active",
          connected_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
          subscribed_fields: subscribed,
          subscription_status: subStatus,
          subscription_error: subError,
          disconnected_at: null,
          pending_delete_at: null,
          page_category: restoredCategory,
          ig_business_account_id: page.ig_business_account_id ?? null,
          ig_username: page.ig_username ?? null,
          ig_picture_url: page.ig_picture_url ?? null,
          ig_subscription_status: igSubStatus,
        },
        { onConflict: "fb_page_id" },
      );
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch back the row id so the frontend can open the category dialog
    const { data: row } = await admin.from("fb_pages").select("id, page_category").eq("fb_page_id", page.id).maybeSingle();

    await admin.from("fb_oauth_sessions").delete().eq("session_token", session_token);

    return new Response(
      JSON.stringify({
        ok: true,
        status: subStatus,
        error: subError,
        ig_status: igSubStatus,
        page: { id: page.id, name: page.name, ig: page.ig_username },
        row_id: row?.id ?? null,
        needs_category: !row?.page_category,
        restored: !!existing?.pending_delete_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
