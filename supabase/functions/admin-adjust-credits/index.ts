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
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(url, service);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const targetUserId: string = body.user_id;
    const amount: number = Number(body.amount);
    const note: string = String(body.note ?? "");
    if (!targetUserId || !Number.isFinite(amount) || amount === 0) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: existing } = await admin.from("user_credits").select("balance").eq("user_id", targetUserId).maybeSingle();
    const newBalance = Number(existing?.balance ?? 0) + amount;
    if (existing) {
      await admin.from("user_credits").update({ balance: newBalance, updated_at: new Date().toISOString() }).eq("user_id", targetUserId);
    } else {
      await admin.from("user_credits").insert({ user_id: targetUserId, balance: newBalance });
    }
    await admin.from("credit_transactions").insert({
      user_id: targetUserId,
      amount,
      type: amount > 0 ? "admin_credit" : "admin_debit",
      description: note || (amount > 0 ? "Admin added credits" : "Admin removed credits"),
      admin_id: user.id,
    });
    await admin.from("admin_audit_log").insert({
      admin_id: user.id,
      action: "adjust_credits",
      target_user: targetUserId,
      payload: { amount, note, new_balance: newBalance },
    });

    return new Response(JSON.stringify({ ok: true, balance: newBalance }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
