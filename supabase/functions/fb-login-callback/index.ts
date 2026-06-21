import { createClient } from "npm:@supabase/supabase-js@2";
import { FB_GRAPH } from "../_shared/fb.ts";

const enc = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function verifyLoginState(secret: string, state: string): Promise<{ redirectTo: string } | null> {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = await hmac(secret, payload);
  if (expected !== sig) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (Date.now() - json.t > 15 * 60 * 1000) return null;
    return { redirectTo: json.r ?? "" };
  } catch { return null; }
}

function callbackUrl(): string {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/fb-login-callback`;
}

function errorPage(message: string, redirectTo: string): Response {
  const safeMsg = message.replace(/</g, "&lt;");
  const back = redirectTo || "/";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Sign-in failed</title>
<style>body{font-family:system-ui;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{background:#1e293b;padding:32px;border-radius:16px;max-width:420px;text-align:center}
a{color:#60a5fa}</style></head><body><div class="card">
<h2>Couldn't sign in with Facebook</h2><p>${safeMsg}</p><p><a href="${back}">Back to sign in</a></p>
</div></body></html>`;
  return new Response(html, { status: 400, headers: { "Content-Type": "text/html" } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");

  const appId = Deno.env.get("FB_APP_ID");
  const appSecret = Deno.env.get("FB_APP_SECRET");
  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let redirectTo = "";
  if (state && appSecret) {
    const v = await verifyLoginState(appSecret, state);
    if (v) redirectTo = v.redirectTo;
  }

  if (error) return errorPage(error, redirectTo);
  if (!code || !state) return errorPage("Missing code or state.", redirectTo);
  if (!appId || !appSecret) return errorPage("Facebook app not configured.", redirectTo);

  const stateCheck = await verifyLoginState(appSecret, state);
  if (!stateCheck) return errorPage("Invalid or expired state.", redirectTo);

  try {
    // Exchange code → access token
    const tokenUrl = new URL(`${FB_GRAPH}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", callbackUrl());
    tokenUrl.searchParams.set("code", code);
    const tokRes = await fetch(tokenUrl);
    const tokJson = await tokRes.json();
    if (!tokRes.ok || !tokJson.access_token) {
      return errorPage(tokJson?.error?.message ?? "Token exchange failed.", redirectTo);
    }
    const accessToken = tokJson.access_token as string;

    // Fetch user profile
    const meRes = await fetch(`${FB_GRAPH}/me?fields=id,email,name,picture&access_token=${encodeURIComponent(accessToken)}`);
    const me = await meRes.json();
    if (!meRes.ok) return errorPage(me?.error?.message ?? "Could not load Facebook profile.", redirectTo);
    if (!me.email) {
      return errorPage("Your Facebook account doesn't have an email on file. Please use Google sign-in instead.", redirectTo);
    }

    const email = String(me.email).toLowerCase();
    const fullName = me.name ?? "";
    const avatarUrl = me.picture?.data?.url ?? "";
    const fbId = me.id;

    const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

    // Find or create user
    // Use listUsers with email filter via REST; admin.getUserByEmail not in JS client → use listUsers + filter
    let userId: string | null = null;
    {
      const { data, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listErr) return errorPage(listErr.message, redirectTo);
      const found = data.users.find((u) => u.email?.toLowerCase() === email);
      if (found) userId = found.id;
    }
    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName, avatar_url: avatarUrl, fb_id: fbId, provider: "facebook" },
      });
      if (createErr) return errorPage(createErr.message, redirectTo);
      userId = created.user!.id;
    }

    // Generate magic link → consuming it lands the browser at redirectTo with a session
    const finalRedirect = redirectTo || `${Deno.env.get("APP_PUBLIC_URL") ?? "https://leadpilot.life"}/dashboard`;
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: finalRedirect },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return errorPage(linkErr?.message ?? "Could not create session.", redirectTo);
    }

    return Response.redirect(linkData.properties.action_link, 302);
  } catch (e) {
    return errorPage(String(e), redirectTo);
  }
});
