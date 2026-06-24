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
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const token: string | undefined = body.token;
    if (!token) return json({ error: "token required" }, 400);

    const { data: invite } = await admin
      .from("page_invites")
      .select("id, page_id, email, role, status, expires_at, accepted_by")
      .eq("token", token)
      .maybeSingle();
    if (!invite) return json({ error: "Invalid invite" }, 404);
    if (invite.status !== "pending") return json({ error: `Invite already ${invite.status}` }, 410);
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      await admin.from("page_invites").update({ status: "expired" }).eq("id", invite.id);
      return json({ error: "Invite expired" }, 410);
    }

    const email = invite.email.toLowerCase();

    // Find or create the auth user
    let userId: string | null = null;
    let createdNewUser = false;
    const { data: existing } = await admin.auth.admin.listUsers();
    const match = existing?.users?.find((u: any) => (u.email || "").toLowerCase() === email);
    if (match) {
      userId = match.id;
    } else {
      // create new user with random password
      const randomPwd = crypto.randomUUID() + crypto.randomUUID();
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: randomPwd,
        email_confirm: true,
        user_metadata: { display_name: email.split("@")[0] },
      });
      if (createErr || !created.user) throw createErr ?? new Error("Failed to create user");
      userId = created.user.id;
      createdNewUser = true;
    }

    // Prevent inviting the page owner as a member
    const { data: page } = await admin
      .from("fb_pages")
      .select("user_id, page_name")
      .eq("id", invite.page_id)
      .maybeSingle();
    if (!page) return json({ error: "Page no longer exists" }, 410);
    if (page.user_id === userId) {
      await admin.from("page_invites").update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: userId }).eq("id", invite.id);
      return json({ ok: true, already_owner: true, page_name: page.page_name });
    }

    // Upsert membership
    const { error: memErr } = await admin
      .from("page_members")
      .upsert(
        { page_id: invite.page_id, user_id: userId, role: invite.role, invited_by: invite.accepted_by ?? null },
        { onConflict: "page_id,user_id" },
      );
    if (memErr) throw memErr;

    await admin
      .from("page_invites")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: userId })
      .eq("id", invite.id);

    // If new user, send password-reset so they can set a password
    if (createdNewUser) {
      const origin = req.headers.get("origin") ?? "https://leadpilot.life";
      await admin.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` });
    }

    return json({
      ok: true,
      page_name: page.page_name,
      role: invite.role,
      created_new_user: createdNewUser,
      email,
    });
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
