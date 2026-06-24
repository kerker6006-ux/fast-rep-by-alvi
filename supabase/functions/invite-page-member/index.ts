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

    const body = await req.json().catch(() => ({}));
    const page_id: string | undefined = body.page_id;
    const emailRaw: string | undefined = body.email;
    const role: "full" | "moderator" = body.role === "full" ? "full" : "moderator";
    if (!page_id || !emailRaw) return json({ error: "page_id and email required" }, 400);
    const email = String(emailRaw).trim().toLowerCase();
    if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(email)) {
      return json({ error: "Only @gmail.com addresses can be invited" }, 400);
    }

    const admin = createClient(url, service);

    // permission check
    const { data: page } = await admin
      .from("fb_pages")
      .select("id, page_name, user_id")
      .eq("id", page_id)
      .maybeSingle();
    if (!page) return json({ error: "Page not found" }, 404);

    let canManage = page.user_id === user.id;
    if (!canManage) {
      const { data: mem } = await admin
        .from("page_members")
        .select("role")
        .eq("page_id", page_id)
        .eq("user_id", user.id)
        .maybeSingle();
      canManage = mem?.role === "full";
    }
    if (!canManage) return json({ error: "Forbidden" }, 403);

    // can't invite the owner
    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", page.user_id)
      .maybeSingle();

    // mark pending invites for this email/page as revoked, then create fresh
    await admin
      .from("page_invites")
      .update({ status: "revoked" })
      .eq("page_id", page_id)
      .eq("status", "pending")
      .ilike("email", email);

    const { data: invite, error: insErr } = await admin
      .from("page_invites")
      .insert({
        page_id,
        email,
        role,
        invited_by: user.id,
        status: "pending",
      })
      .select("id, token")
      .single();
    if (insErr) throw insErr;

    // send email
    const { data: inviterProfile } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    const origin = req.headers.get("origin") ?? "https://leadpilot.life";
    const acceptUrl = `${origin}/accept-invite?token=${invite.token}`;

    await admin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "page-invite",
        recipientEmail: email,
        idempotencyKey: `page-invite-${invite.id}`,
        templateData: {
          inviterName: inviterProfile?.display_name || user.email || "A teammate",
          inviterEmail: user.email,
          pageName: page.page_name || "a Facebook page",
          roleLabel: role === "full" ? "Full Access" : "Moderator",
          acceptUrl,
        },
      },
    });

    return json({ ok: true, invite_id: invite.id });
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
