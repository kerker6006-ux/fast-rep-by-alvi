import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const includeDetails = req.method === "GET"
      ? new URL(req.url).searchParams.get("include_details") === "true"
      : ((await req.json().catch(() => ({}))) as { include_details?: boolean }).include_details === true;
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(url, service);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Paginate through auth.users
    const emails: Record<string, string> = {};
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      for (const u of data.users) {
        if (u.email) emails[u.id] = u.email;
      }
      if (data.users.length < perPage) break;
      page++;
      if (page > 50) break; // safety
    }

    if (!includeDetails) {
      return new Response(JSON.stringify({ emails }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const [{ data: profiles }, { data: credits }, { data: products }, { data: orders }, { data: conversations }, { data: pages }, { data: aiUsage }] = await Promise.all([
      admin.from("profiles").select("id, display_name, full_name, country, user_type, created_at, suspended, onboarded_at").order("created_at", { ascending: false }),
      admin.from("user_credits").select("user_id, balance"),
      admin.from("products").select("user_id"),
      admin.from("orders").select("user_id"),
      admin.from("conversations").select("user_id"),
      admin.from("fb_pages").select("user_id, page_name"),
      admin.from("ai_usage").select("user_id, cost"),
    ]);

    const countByUser = (rows: Array<{ user_id?: string | null }> | null | undefined) => {
      const counts: Record<string, number> = {};
      for (const row of rows ?? []) {
        if (row.user_id) counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
      }
      return counts;
    };

    const balanceByUser = Object.fromEntries((credits ?? []).map((row) => [row.user_id, Number(row.balance ?? 0)]));
    const pagesByUser = (pages ?? []).reduce<Record<string, Array<{ page_name: string | null }>>>((acc, row) => {
      if (!row.user_id) return acc;
      acc[row.user_id] ??= [];
      acc[row.user_id].push({ page_name: row.page_name });
      return acc;
    }, {});
    const aiSpendByUser: Record<string, number> = {};
    for (const row of aiUsage ?? []) {
      if (!row.user_id) continue;
      aiSpendByUser[row.user_id] = (aiSpendByUser[row.user_id] ?? 0) + Number(row.cost ?? 0);
    }
    const productCounts = countByUser(products);
    const orderCounts = countByUser(orders);
    const conversationCounts = countByUser(conversations);

    const users = (profiles ?? []).map((profile) => ({
      ...profile,
      email: emails[profile.id] ?? null,
      balance: balanceByUser[profile.id] ?? 0,
      productCount: productCounts[profile.id] ?? 0,
      orderCount: orderCounts[profile.id] ?? 0,
      conversationCount: conversationCounts[profile.id] ?? 0,
      aiSpend: aiSpendByUser[profile.id] ?? 0,
      pages: pagesByUser[profile.id] ?? [],
    }));

    return new Response(JSON.stringify({ emails, users }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
