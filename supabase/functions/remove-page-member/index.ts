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
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { member_id } = await req.json();
    if (!member_id) return json({ error: "member_id required" }, 400);

    const admin = createClient(url, service);
    const { data: mem } = await admin
      .from("page_members")
      .select("id, page_id, user_id")
      .eq("id", member_id)
      .maybeSingle();
    if (!mem) return json({ error: "Not found" }, 404);

    const { data: page } = await admin.from("fb_pages").select("user_id").eq("id", mem.page_id).maybeSingle();
    let canManage = page?.user_id === user.id;
    if (!canManage) {
      const { data: m } = await admin
        .from("page_members")
        .select("role")
        .eq("page_id", mem.page_id)
        .eq("user_id", user.id)
        .maybeSingle();
      canManage = m?.role === "full";
    }
    if (!canManage) return json({ error: "Forbidden" }, 403);

    await admin.from("page_members").delete().eq("id", member_id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
