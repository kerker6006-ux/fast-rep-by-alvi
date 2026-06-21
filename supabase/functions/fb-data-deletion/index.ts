// Facebook Data Deletion Callback
// https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_SECRET = Deno.env.get("FB_APP_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE = "https://leadpilot.life";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function b64urlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlToString(input: string): string {
  return new TextDecoder().decode(b64urlDecode(input));
}

async function hmacSha256(key: string, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function parseSignedRequest(signedRequest: string): Promise<{ user_id?: string } | null> {
  if (!signedRequest || !signedRequest.includes(".")) return null;
  const [encodedSig, payload] = signedRequest.split(".", 2);
  const expected = await hmacSha256(APP_SECRET, payload);
  const provided = b64urlDecode(encodedSig);
  if (!timingSafeEqual(expected, provided)) return null;
  try {
    return JSON.parse(b64urlToString(payload));
  } catch {
    return null;
  }
}

async function deleteUserData(fbUserId: string): Promise<void> {
  // Find all pages owned by this FB user, hard-delete child data, then delete pages.
  const { data: pages } = await supabase
    .from("fb_pages")
    .select("id")
    .eq("fb_user_id", fbUserId);

  const pageIds = (pages ?? []).map((p) => p.id);
  if (pageIds.length === 0) return;

  // Best-effort cascade across known per-page tables
  for (const table of [
    "messages",
    "conversations",
    "orders",
    "complaints",
    "leads",
    "products",
    "pending_products",
    "auto_reply_rules",
    "comment_triggers",
    "comment_trigger_logs",
    "scheduled_messages",
    "website_knowledge",
    "training_suggestions",
    "product_suggestions",
  ]) {
    try {
      await supabase.from(table).delete().in("fb_page_id", pageIds);
    } catch (_) { /* table may not have fb_page_id; ignore */ }
  }
  await supabase.from("fb_pages").delete().in("id", pageIds);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let signedRequest = "";
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      signedRequest = body.signed_request ?? "";
    } else {
      const form = await req.formData().catch(() => null);
      signedRequest = (form?.get("signed_request") as string | null) ?? "";
    }

    if (!signedRequest) {
      return new Response(JSON.stringify({ error: "missing signed_request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = await parseSignedRequest(signedRequest);
    if (!parsed || !parsed.user_id) {
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const confirmationCode = crypto.randomUUID().replace(/-/g, "");
    await supabase.from("data_deletion_requests").insert({
      confirmation_code: confirmationCode,
      user_facebook_id: parsed.user_id,
      signed_request: signedRequest,
      status: "processing",
    });

    // Best-effort synchronous deletion; mark complete or failed
    try {
      await deleteUserData(parsed.user_id);
      await supabase
        .from("data_deletion_requests")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("confirmation_code", confirmationCode);
    } catch (e) {
      await supabase
        .from("data_deletion_requests")
        .update({ status: "failed", error: String(e) })
        .eq("confirmation_code", confirmationCode);
    }

    return new Response(
      JSON.stringify({
        url: `${PUBLIC_SITE}/data-deletion-status?code=${confirmationCode}`,
        confirmation_code: confirmationCode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
