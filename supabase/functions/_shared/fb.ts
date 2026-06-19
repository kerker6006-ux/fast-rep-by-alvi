// Shared helpers for Facebook OAuth edge functions
export const FB_API_VERSION = "v21.0";
export const FB_GRAPH = `https://graph.facebook.com/${FB_API_VERSION}`;

export const SUBSCRIBED_FIELDS = [
  "messages",
  "messaging_postbacks",
  "message_deliveries",
  "message_reads",
  "messaging_optins",
  "feed",
  "leadgen",
];

// Instagram webhook fields (subscribed on the IG user via {ig-user-id}/subscribed_apps)
export const IG_SUBSCRIBED_FIELDS = [
  "messages",
  "messaging_postbacks",
  "comments",
  "mentions",
  "message_reactions",
];

export const OAUTH_SCOPES = [
  "pages_show_list",
  "pages_manage_metadata",
  "pages_messaging",
  "pages_read_engagement",
  "pages_manage_engagement",
  "pages_read_user_content",
  "leads_retrieval",
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_manage_comments",
];

const enc = new TextEncoder();

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signState(secret: string, userId: string): Promise<string> {
  const payload = btoa(JSON.stringify({ u: userId, t: Date.now(), n: crypto.randomUUID() }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifyState(secret: string, state: string): Promise<{ userId: string } | null> {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = await hmac(secret, payload);
  if (expected !== sig) return null;
  try {
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64));
    if (Date.now() - json.t > 15 * 60 * 1000) return null; // 15 min
    return { userId: json.u };
  } catch {
    return null;
  }
}

export function getOrigin(): string {
  return Deno.env.get("APP_PUBLIC_URL") ?? "https://fast-rep-by-alvi.lovable.app";
}

export function callbackUrl(): string {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/fb-oauth-callback`;
}
