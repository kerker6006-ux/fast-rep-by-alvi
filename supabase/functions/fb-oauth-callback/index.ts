import { createClient } from "npm:@supabase/supabase-js@2";
import { FB_GRAPH, callbackUrl, getOrigin, verifyState } from "../_shared/fb.ts";

function htmlRedirect(url: string, msg: string) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>${msg}</title>
     <script>window.location.replace(${JSON.stringify(url)});</script>
     <p style="font-family:sans-serif;padding:20px">${msg} <a href="${url}">Continue</a></p>`,
    { status: 200, headers: { "Content-Type": "text/html" } },
  );
}

Deno.serve(async (req) => {
  const appOrigin = getOrigin();
  try {
    const appId = Deno.env.get("FB_APP_ID");
    const appSecret = Deno.env.get("FB_APP_SECRET");
    if (!appId || !appSecret) {
      return htmlRedirect(`${appOrigin}/?fb_error=not_configured`, "Facebook app not configured");
    }

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const fbError = url.searchParams.get("error");
    if (fbError) return htmlRedirect(`${appOrigin}/?fb_error=${encodeURIComponent(fbError)}`, "Facebook denied authorization");
    if (!code || !state) return htmlRedirect(`${appOrigin}/?fb_error=missing_code`, "Missing code");

    const verified = await verifyState(appSecret, state);
    if (!verified) return htmlRedirect(`${appOrigin}/?fb_error=bad_state`, "Invalid state");

    // Exchange code -> short-lived user token
    const tokenRes = await fetch(
      `${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: callbackUrl(),
        code,
      }),
    );
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      return htmlRedirect(`${appOrigin}/?fb_error=token_exchange`, "Token exchange failed");
    }

    // Upgrade to long-lived user token
    const longRes = await fetch(
      `${FB_GRAPH}/oauth/access_token?` + new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: tokenJson.access_token,
      }),
    );
    const longJson = await longRes.json();
    const userAccessToken = longJson.access_token || tokenJson.access_token;

    // Fetch pages with linked Instagram Business Account
    const pagesRes = await fetch(
      `${FB_GRAPH}/me/accounts?fields=id,name,access_token,category,picture{url},tasks,instagram_business_account{id,username,profile_picture_url}&limit=200&access_token=${encodeURIComponent(userAccessToken)}`,
    );
    const pagesJson = await pagesRes.json();
    if (!pagesRes.ok) {
      return htmlRedirect(`${appOrigin}/?fb_error=pages_fetch`, "Could not load pages");
    }
    const pages = (pagesJson.data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      access_token: p.access_token,
      category: p.category ?? null,
      picture_url: p.picture?.data?.url ?? null,
      tasks: p.tasks ?? [],
      ig_business_account_id: p.instagram_business_account?.id ?? null,
      ig_username: p.instagram_business_account?.username ?? null,
      ig_picture_url: p.instagram_business_account?.profile_picture_url ?? null,
    }));

    // Store session row keyed by random session token
    const sessionToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("fb_oauth_sessions").insert({
      session_token: sessionToken,
      user_id: verified.userId,
      user_access_token: userAccessToken,
      pages,
    });
    if (error) {
      return htmlRedirect(`${appOrigin}/dashboard?fb_error=session_store#fb-pages`, "Could not save session");
    }

    return htmlRedirect(`${appOrigin}/dashboard?fb_session=${sessionToken}#fb-pages`, "Loading your pages...");
  } catch (e) {
    return htmlRedirect(`${appOrigin}/dashboard?fb_error=${encodeURIComponent((e as Error).message)}#fb-pages`, "Unexpected error");
  }
});
