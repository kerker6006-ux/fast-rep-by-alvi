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

const ALLOWED_REDIRECT_ORIGINS = new Set([
  "https://leadpilot.life",
  "https://www.leadpilot.life",
  "https://fast-rep-by-alvi.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
]);

function isAllowedRedirect(target: string): boolean {
  try {
    const u = new URL(target);
    if (ALLOWED_REDIRECT_ORIGINS.has(u.origin)) return true;
    // Allow lovable preview subdomains
    if (u.protocol === "https:" && /\.lovable\.app$/.test(u.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const redirectTo = url.searchParams.get("redirect_to") || "";
    if (!redirectTo || !isAllowedRedirect(redirectTo)) {
      return new Response(JSON.stringify({ error: "Invalid redirect_to" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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
    authUrl.searchParams.set("response_type", "code");

    return new Response(JSON.stringify({ url: authUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
