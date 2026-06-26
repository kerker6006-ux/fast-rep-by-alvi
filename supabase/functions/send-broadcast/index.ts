import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { broadcast_id } = await req.json();
    if (!broadcast_id) throw new Error("Missing broadcast_id");

    // Load broadcast record
    const { data: broadcast, error: bErr } = await supabase
      .from("broadcasts")
      .select("*, fb_pages(page_access_token, fb_page_id)")
      .eq("id", broadcast_id)
      .maybeSingle();

    if (bErr || !broadcast) throw new Error("Broadcast not found");
    if (broadcast.status !== "pending") throw new Error("Broadcast already processed");

    const pageToken = broadcast.fb_pages?.page_access_token;
    if (!pageToken) throw new Error("No page access token found");

    // Mark as sending
    await supabase.from("broadcasts").update({ status: "sending" }).eq("id", broadcast_id);

    // Get all recipients (messaged in last 24h)
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, fb_sender_id")
      .eq("fb_page_id", broadcast.fb_page_id)
      .gte("last_message_at", since24h);

    if (!conversations?.length) {
      await supabase.from("broadcasts")
        .update({ status: "done", sent_count: 0, failed_count: 0, sent_at: new Date().toISOString() })
        .eq("id", broadcast_id);
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;
    let failedCount = 0;

    // Send to each recipient with rate limiting (Facebook allows ~250 sends/min)
    for (const convo of conversations) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/me/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${pageToken}`,
            },
            body: JSON.stringify({
              recipient: { id: convo.fb_sender_id },
              message: { text: broadcast.message },
              // Use correct messaging_type based on broadcast tag
              // RESPONSE = within 24h window (free)
              // MESSAGE_TAG = outside 24h window with specific tag
              messaging_type: broadcast.message_tag ? "MESSAGE_TAG" : "RESPONSE",
              ...(broadcast.message_tag && { tag: broadcast.message_tag }),
            }),
          }
        );

        if (res.ok) {
          sentCount++;
          // Save as outgoing message in conversation
          await supabase.from("messages").insert({
            conversation_id: convo.id,
            direction: "outgoing",
            content: broadcast.message,
            user_id: broadcast.user_id,
          });
        } else {
          failedCount++;
          console.error("Failed to send to", convo.fb_sender_id, await res.text());
        }
      } catch (e) {
        failedCount++;
        console.error("Error sending to", convo.fb_sender_id, e);
      }

      // Rate limit: small delay between sends to avoid hitting Facebook limits
      await new Promise(r => setTimeout(r, 100));
    }

    // Mark broadcast as done
    await supabase.from("broadcasts").update({
      status: "done",
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: new Date().toISOString(),
    }).eq("id", broadcast_id);

    // Notify owner
    await supabase.from("notifications").insert({
      user_id: broadcast.user_id,
      type: "broadcast",
      title: "Broadcast sent",
      body: `Sent to ${sentCount} subscribers${failedCount > 0 ? `, ${failedCount} failed` : ""}`,
      link: "#broadcast",
      fb_page_id: broadcast.fb_page_id,
    });

    return new Response(JSON.stringify({ success: true, sent: sentCount, failed: failedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("Broadcast error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
