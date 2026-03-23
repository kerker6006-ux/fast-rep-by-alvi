import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERIFY_TOKEN = "fb_bot_verify_2024";

serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);

  // Facebook webhook verification (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Also check custom verify token from DB
    let dbToken = VERIFY_TOKEN;
    try {
      const { data } = await supabase.from("bot_settings").select("setting_value").eq("setting_key", "verify_token").single();
      if (data) dbToken = data.setting_value;
    } catch {}

    if (mode === "subscribe" && (token === VERIFY_TOKEN || token === dbToken)) {
      console.log("Webhook verified!");
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // Facebook sends POST with messages
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Received webhook:", JSON.stringify(body));

      if (body.object !== "page") {
        return new Response("Not a page event", { status: 200, headers: corsHeaders });
      }

      // Get FB Page Access Token from secrets
      const PAGE_ACCESS_TOKEN = Deno.env.get("FB_PAGE_ACCESS_TOKEN");
      if (!PAGE_ACCESS_TOKEN) {
        console.error("FB_PAGE_ACCESS_TOKEN not set");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

      for (const entry of body.entry || []) {
        for (const event of entry.messaging || []) {
          const senderId = event.sender?.id;
          if (!senderId) continue;

          // Skip if message is from the page itself
          if (senderId === entry.id) continue;

          const messageText = event.message?.text;
          const attachments = event.message?.attachments;

          // Get or create conversation
          let conversationId: string;
          const { data: existingConvo } = await supabase
            .from("conversations")
            .select("id")
            .eq("fb_sender_id", senderId)
            .single();

          if (existingConvo) {
            conversationId = existingConvo.id;
          } else {
            // Try to get sender name from FB
            let senderName = null;
            try {
              const profileRes = await fetch(
                `https://graph.facebook.com/${senderId}?fields=first_name,last_name&access_token=${PAGE_ACCESS_TOKEN}`
              );
              const profile = await profileRes.json();
              senderName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || null;
            } catch {}

            const { data: newConvo, error } = await supabase
              .from("conversations")
              .insert({ fb_sender_id: senderId, sender_name: senderName })
              .select("id")
              .single();
            if (error) {
              console.error("Error creating conversation:", error);
              continue;
            }
            conversationId = newConvo.id;
          }

          // Determine image URL from attachments
          let imageUrl: string | null = null;
          if (attachments) {
            const imageAttachment = attachments.find((a: any) => a.type === "image");
            if (imageAttachment) {
              imageUrl = imageAttachment.payload?.url || null;
            }
          }

          // Save incoming message
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            fb_message_id: event.message?.mid,
            direction: "incoming",
            content: messageText || (imageUrl ? "[Image]" : null),
            image_url: imageUrl,
          });

          // Update conversation
          await supabase.from("conversations").update({
            last_message: messageText || "[Image]",
            last_message_at: new Date().toISOString(),
          }).eq("id", conversationId);

          // Get recent message history for context
          const { data: recentMessages } = await supabase
            .from("messages")
            .select("direction, content, image_url")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: false })
            .limit(10);

          // Get products
          const { data: products } = await supabase
            .from("products")
            .select("name, name_bn, description, description_bn, price, category, keywords, image_url")
            .eq("is_active", true);

          // Get bot settings
          const { data: settingsRows } = await supabase.from("bot_settings").select("setting_key, setting_value");
          const settings: Record<string, string> = {};
          settingsRows?.forEach((s: any) => { settings[s.setting_key] = s.setting_value; });

          // Build product catalog text
          const productCatalog = products?.map(p =>
            `- ${p.name}${p.name_bn ? ` (${p.name_bn})` : ""}: ৳${p.price}${p.description ? ` — ${p.description}` : ""}${p.description_bn ? ` (${p.description_bn})` : ""}${p.category ? ` [Category: ${p.category}]` : ""}${p.keywords?.length ? ` [Keywords: ${p.keywords.join(", ")}]` : ""}${p.image_url ? ` [Has image]` : ""}`
          ).join("\n") || "No products available.";

          // Build conversation history
          const chatHistory = (recentMessages || []).reverse().map(m => ({
            role: m.direction === "incoming" ? "user" as const : "assistant" as const,
            content: m.image_url && m.direction === "incoming"
              ? [
                  { type: "text" as const, text: m.content || "Customer sent an image" },
                  { type: "image_url" as const, image_url: { url: m.image_url } }
                ]
              : m.content || "",
          }));

          // Build current message (with image if present)
          const currentUserMessage: any = imageUrl
            ? {
                role: "user",
                content: [
                  { type: "text", text: messageText || "Customer sent this image. Identify the product and tell the price." },
                  { type: "image_url", image_url: { url: imageUrl } }
                ]
              }
            : { role: "user", content: messageText || "" };

          // Build system prompt
          const systemPrompt = `You are an AI assistant for "${settings.business_name || "a business"}" Facebook page.
${settings.business_description ? `Business: ${settings.business_description}` : ""}

LANGUAGE RULES:
- Default language is Bangla (বাংলা). Reply in Bangla by default.
- If the customer writes in English, reply in English.
- If the customer writes in Bangla, reply in Bangla.
- You can mix Bangla and English naturally if needed.

PRODUCT CATALOG:
${productCatalog}

YOUR JOB:
- Understand customer questions deeply — about products, prices, availability, delivery, etc.
- If a customer sends a product image, try to match it with products in the catalog based on visual similarity, name, or keywords.
- Always mention the price (৳) when discussing a product.
- Be warm, friendly, and helpful like a real shop assistant.
- If you can't find a matching product, politely say so and ask for more details.
- Keep responses concise but informative.
- Use emojis naturally 😊

${settings.custom_instructions || ""}

IMPORTANT: You are chatting on Facebook Messenger. Keep messages short and conversational. Don't use markdown formatting.`;

          if (LOVABLE_API_KEY) {
            try {
              // Remove the last user message from history since we're adding it separately
              const historyWithoutLast = chatHistory.slice(0, -1);

              const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    { role: "system", content: systemPrompt },
                    ...historyWithoutLast,
                    currentUserMessage,
                  ],
                }),
              });

              if (!aiResponse.ok) {
                const errText = await aiResponse.text();
                console.error("AI Gateway error:", aiResponse.status, errText);
                throw new Error("AI error");
              }

              const aiData = await aiResponse.json();
              const replyText = aiData.choices?.[0]?.message?.content || settings.welcome_message || "ধন্যবাদ! আপনার মেসেজ পেয়েছি।";

              // Send reply via Facebook
              await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  recipient: { id: senderId },
                  message: { text: replyText },
                }),
              });

              // Save outgoing message
              await supabase.from("messages").insert({
                conversation_id: conversationId,
                direction: "outgoing",
                content: replyText,
              });

              // Update conversation
              await supabase.from("conversations").update({
                last_message: replyText,
                last_message_at: new Date().toISOString(),
              }).eq("id", conversationId);

            } catch (aiError) {
              console.error("AI processing error:", aiError);
              // Send fallback message
              const fallback = settings.welcome_message || "ধন্যবাদ! আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।";
              await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  recipient: { id: senderId },
                  message: { text: fallback },
                }),
              });
            }
          }
        }
      }

      return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
