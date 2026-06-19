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
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(url, service);
    const { id } = await req.json();
    const { data: page, error } = await admin.from("fb_pages").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error || !page) return new Response(JSON.stringify({ error: "Page not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Test the access token by calling /me on Graph API
    const resp = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name,category&access_token=${encodeURIComponent(page.page_access_token)}`);
    const json = await resp.json();
    if (!resp.ok || json.error) {
      return new Response(JSON.stringify({ ok: false, error: json.error?.message || "Token invalid" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, page: json }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
