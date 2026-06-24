import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const { conversation_id, text, image_url } = body;
    if (!conversation_id || (!text && !image_url)) {
      return new Response(JSON.stringify({ error: "conversation_id and text or image_url required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Load conversation
    const { data: convo, error: cErr } = await admin
      .from("conversations")
      .select("id, user_id, fb_sender_id, fb_page_id")
      .eq("id", conversation_id)
      .single();
    if (cErr || !convo) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Access check: caller must be owner of the page OR a page member
    let hasAccess = convo.user_id === userId;
    if (!hasAccess && convo.fb_page_id) {
      const { data: mem } = await admin
        .from("page_members").select("id")
        .eq("page_id", convo.fb_page_id).eq("user_id", userId).maybeSingle();
      hasAccess = !!mem;
    }
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check 24h messaging window
    const { data: lastIncoming } = await admin
      .from("messages")
      .select("created_at")
      .eq("conversation_id", conversation_id)
      .eq("direction", "incoming")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastIncoming) {
      return new Response(JSON.stringify({ error: "No incoming messages — cannot start conversation outside 24h window per Meta policy." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const hoursSince = (Date.now() - new Date(lastIncoming.created_at).getTime()) / 36e5;
    if (hoursSince > 24) {
      return new Response(JSON.stringify({ error: `Outside 24-hour messaging window (${Math.floor(hoursSince)}h since last customer message). Meta policy blocks this send.` }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load page access token using the page this conversation belongs to
    const { data: page } = await admin
      .from("fb_pages")
      .select("page_access_token")
      .eq("id", convo.fb_page_id)
      .maybeSingle();
    const pat = page?.page_access_token || Deno.env.get("FB_PAGE_ACCESS_TOKEN");
    if (!pat) {
      return new Response(JSON.stringify({ error: "No page access token configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messagePayload: any = { recipient: { id: convo.fb_sender_id }, messaging_type: "RESPONSE" };
    if (image_url) {
      messagePayload.message = { attachment: { type: "image", payload: { url: image_url, is_reusable: true } } };
    } else {
      messagePayload.message = { text };
    }

    const fbResp = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${pat}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messagePayload),
    });
    const fbJson = await fbResp.json();
    if (!fbResp.ok) {
      console.error("FB send error:", fbJson);
      return new Response(JSON.stringify({ error: fbJson.error?.message || "Facebook send failed", fb: fbJson }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Record outgoing message
    await admin.from("messages").insert({
      user_id: userId,
      conversation_id,
      direction: "outgoing",
      content: text || null,
      image_url: image_url || null,
      fb_message_id: fbJson.message_id || null,
    });

    await admin.from("conversations").update({
      last_message: text || "[image]",
      last_message_at: new Date().toISOString(),
    }).eq("id", conversation_id);

    return new Response(JSON.stringify({ success: true, fb_message_id: fbJson.message_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-fb-message error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
