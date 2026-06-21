import { FB_API_VERSION } from "../_shared/fb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const enc = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signLoginState(secret: string, redirectTo: string): Promise<string> {
  const payload = btoa(JSON.stringify({ r: redirectTo, t: Date.now(), n: crypto.randomUUID() }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

function callbackUrl(): string {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/fb-login-callback`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const redirectTo = url.searchParams.get("redirect_to") || "";
    const appId = Deno.env.get("FB_APP_ID");
    const appSecret = Deno.env.get("FB_APP_SECRET");
    if (!appId || !appSecret) {
      return new Response(JSON.stringify({ error: "FB app not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const state = await signLoginState(appSecret, redirectTo);
    const authUrl = new URL(`https://www.facebook.com/${FB_API_VERSION}/dialog/oauth`);
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", callbackUrl());
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", "public_profile");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("auth_type", "rerequest");

    return new Response(JSON.stringify({ url: authUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
