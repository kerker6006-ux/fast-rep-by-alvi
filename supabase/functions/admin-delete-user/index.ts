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
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(url, service);
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!role) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const { user_id } = await req.json();
    if (!user_id || user_id === user.id) {
      return new Response(JSON.stringify({ error: "Invalid target" }), { status: 400, headers: corsHeaders });
    }

    // Delete user data
    for (const table of ["products","orders","conversations","messages","auto_reply_rules","scheduled_messages","bot_settings","complaints","fb_pages","user_credits","credit_transactions","website_knowledge","pending_products","product_suggestions","ai_usage","user_roles","profiles"]) {
      await admin.from(table).delete().eq(table === "profiles" ? "id" : "user_id", user_id);
    }
    await admin.auth.admin.deleteUser(user_id);
    await admin.from("admin_audit_log").insert({ admin_id: user.id, action: "delete_user", target_user: user_id });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
