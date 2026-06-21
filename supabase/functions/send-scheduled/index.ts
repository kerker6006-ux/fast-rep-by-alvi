import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // ===== Require service_role JWT (called by pg_cron with service role bearer) =====
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (!token || token !== supabaseKey) {
    // Fallback: decode JWT payload and check role
    let role = "";
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        role = payload.role || "";
      }
    } catch { /* ignore */ }
    if (role !== "service_role") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const PAGE_ACCESS_TOKEN = Deno.env.get("FB_PAGE_ACCESS_TOKEN");
  if (!PAGE_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: "FB_PAGE_ACCESS_TOKEN not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Get pending scheduled messages that are due
    const { data: messages, error } = await supabase
      .from("scheduled_messages")
      .select("*, conversations(fb_sender_id)")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;
    for (const msg of messages) {
      const senderId = msg.conversations?.fb_sender_id;
      if (!senderId) {
        await supabase.from("scheduled_messages").update({ status: "failed", error: "no_sender" }).eq("id", msg.id);
        continue;
      }

      // ===== Meta 24-hour messaging window enforcement =====
      // Find the last inbound (user -> page) message in this conversation.
      const { data: lastInbound } = await supabase
        .from("messages")
        .select("created_at")
        .eq("conversation_id", msg.conversation_id)
        .eq("direction", "incoming")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastInboundAt = lastInbound?.created_at ? new Date(lastInbound.created_at).getTime() : 0;
      const hoursSince = lastInboundAt ? (Date.now() - lastInboundAt) / 3_600_000 : Infinity;
      const withinWindow = hoursSince <= 24;

      // Outside the 24-hour window, we MUST NOT send a promotional follow-up.
      // Meta only allows tagged messages (CONFIRMED_EVENT_UPDATE / POST_PURCHASE_UPDATE / ACCOUNT_UPDATE)
      // and the content must match the tag. We refuse to send to stay policy-compliant.
      if (!withinWindow) {
        await supabase.from("scheduled_messages").update({
          status: "skipped_policy",
          error: "Outside Meta's 24-hour messaging window. Message not sent to comply with Messenger Platform Policy.",
        }).eq("id", msg.id);
        continue;
      }

      try {
        const fbRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: senderId },
            messaging_type: "RESPONSE", // valid: we are within 24h of user's last message
            message: { text: msg.content },
          }),
        });

        if (fbRes.ok) {
          await supabase.from("scheduled_messages").update({
            status: "sent", sent_at: new Date().toISOString(),
          }).eq("id", msg.id);

          await supabase.from("messages").insert({
            conversation_id: msg.conversation_id, direction: "outgoing", content: msg.content,
          });
          await supabase.from("conversations").update({
            last_message: msg.content, last_message_at: new Date().toISOString(),
          }).eq("id", msg.conversation_id);

          sentCount++;
        } else {
          const errText = await fbRes.text();
          console.error("FB send error:", errText);
          await supabase.from("scheduled_messages").update({ status: "failed", error: errText.slice(0, 500) }).eq("id", msg.id);
        }
      } catch (e) {
        console.error("Send error:", e);
        await supabase.from("scheduled_messages").update({ status: "failed", error: String(e).slice(0, 500) }).eq("id", msg.id);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scheduled messages error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
