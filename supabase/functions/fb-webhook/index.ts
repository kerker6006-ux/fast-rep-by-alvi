import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERIFY_TOKEN = "fb_bot_verify_2024";

serve(async (req) => {
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
          if (senderId === entry.id) continue;

          // Skip non-message events (delivery receipts, read receipts, etc.)
          if (!event.message) continue;

          // Skip echo messages (sent by the page itself)
          if (event.message.is_echo) continue;

          const messageText = event.message.text;
          const attachments = event.message.attachments;

          // Get or create conversation
          const conversationId = await getOrCreateConversation(supabase, senderId, PAGE_ACCESS_TOKEN);
          if (!conversationId) continue;

          // Determine image URL from attachments
          let imageUrl: string | null = null;
          if (attachments) {
            const imageAttachment = attachments.find((a: any) => a.type === "image");
            if (imageAttachment) imageUrl = imageAttachment.payload?.url || null;
          }

          // Save incoming message
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            fb_message_id: event.message?.mid,
            direction: "incoming",
            content: messageText || (imageUrl ? "[Image]" : null),
            image_url: imageUrl,
          });

          await supabase.from("conversations").update({
            last_message: messageText || "[Image]",
            last_message_at: new Date().toISOString(),
          }).eq("id", conversationId);

          // Check auto-reply rules first
          const autoReply = await checkAutoReplyRules(supabase, messageText);
          if (autoReply) {
            await sendFbMessage(PAGE_ACCESS_TOKEN, senderId, autoReply);
            await saveOutgoingMessage(supabase, conversationId, autoReply);
            continue;
          }

          // AI-powered response
          if (LOVABLE_API_KEY) {
            try {
              const replyText = await generateAiReply(
                supabase, LOVABLE_API_KEY, conversationId, messageText, imageUrl
              );

              await sendFbMessage(PAGE_ACCESS_TOKEN, senderId, replyText);
              await saveOutgoingMessage(supabase, conversationId, replyText);

              // Detect order intent and create order if applicable
              await detectAndCreateOrder(supabase, LOVABLE_API_KEY, conversationId, messageText, replyText);

            } catch (aiError) {
              console.error("AI processing error:", aiError);
              const { data: settingsRows } = await supabase.from("bot_settings").select("setting_key, setting_value");
              const settings: Record<string, string> = {};
              settingsRows?.forEach((s: any) => { settings[s.setting_key] = s.setting_value; });
              const fallback = settings.welcome_message || "ধন্যবাদ! আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।";
              await sendFbMessage(PAGE_ACCESS_TOKEN, senderId, fallback);
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

// ---- Helper Functions ----

async function getOrCreateConversation(supabase: any, senderId: string, pageAccessToken: string): Promise<string | null> {
  const { data: existingConvo } = await supabase
    .from("conversations").select("id").eq("fb_sender_id", senderId).single();

  if (existingConvo) return existingConvo.id;

  let senderName = null;
  try {
    const profileRes = await fetch(
      `https://graph.facebook.com/${senderId}?fields=first_name,last_name&access_token=${pageAccessToken}`
    );
    const profile = await profileRes.json();
    senderName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || null;
  } catch {}

  const { data: newConvo, error } = await supabase
    .from("conversations").insert({ fb_sender_id: senderId, sender_name: senderName }).select("id").single();
  if (error) { console.error("Error creating conversation:", error); return null; }
  return newConvo.id;
}

async function checkAutoReplyRules(supabase: any, messageText: string | null): Promise<string | null> {
  if (!messageText) return null;
  const { data: rules } = await supabase
    .from("auto_reply_rules").select("*").eq("is_active", true).order("priority", { ascending: false });

  if (!rules) return null;
  const lowerMsg = messageText.toLowerCase();

  for (const rule of rules) {
    const keywords: string[] = rule.trigger_keywords || [];
    const matched = keywords.some((kw: string) => lowerMsg.includes(kw.toLowerCase()));
    if (matched) {
      // Detect language - simple heuristic
      const isBangla = /[\u0980-\u09FF]/.test(messageText);
      return (isBangla && rule.response_text_bn) ? rule.response_text_bn : rule.response_text;
    }
  }
  return null;
}

async function sendFbMessage(pageAccessToken: string, recipientId: string, text: string) {
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
}

async function saveOutgoingMessage(supabase: any, conversationId: string, content: string) {
  await supabase.from("messages").insert({ conversation_id: conversationId, direction: "outgoing", content });
  await supabase.from("conversations").update({
    last_message: content, last_message_at: new Date().toISOString(),
  }).eq("id", conversationId);
}

async function generateAiReply(
  supabase: any, apiKey: string, conversationId: string,
  messageText: string | null, imageUrl: string | null
): Promise<string> {
  const { data: recentMessages } = await supabase
    .from("messages").select("direction, content, image_url")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(10);

  const { data: products } = await supabase
    .from("products").select("name, name_bn, description, description_bn, price, category, keywords, image_url")
    .eq("is_active", true);

  const { data: settingsRows } = await supabase.from("bot_settings").select("setting_key, setting_value");
  const settings: Record<string, string> = {};
  settingsRows?.forEach((s: any) => { settings[s.setting_key] = s.setting_value; });

  const productCatalog = products?.map((p: any) =>
    `- ${p.name}${p.name_bn ? ` (${p.name_bn})` : ""}: ৳${p.price}${p.description ? ` — ${p.description}` : ""}${p.category ? ` [${p.category}]` : ""}${p.keywords?.length ? ` [${p.keywords.join(", ")}]` : ""}`
  ).join("\n") || "No products available.";

  const chatHistory = (recentMessages || []).reverse().map((m: any) => ({
    role: m.direction === "incoming" ? "user" as const : "assistant" as const,
    content: m.image_url && m.direction === "incoming"
      ? [{ type: "text" as const, text: m.content || "Customer sent an image" }, { type: "image_url" as const, image_url: { url: m.image_url } }]
      : m.content || "",
  }));

  const currentUserMessage: any = imageUrl
    ? { role: "user", content: [{ type: "text", text: messageText || "Customer sent this image. Identify the product and tell the price." }, { type: "image_url", image_url: { url: imageUrl } }] }
    : { role: "user", content: messageText || "" };

  const systemPrompt = `You are an AI assistant for "${settings.business_name || "a business"}" Facebook page.
${settings.business_description ? `Business: ${settings.business_description}` : ""}

LANGUAGE RULES:
- Default language is Bangla (বাংলা). Reply in Bangla by default.
- If the customer writes in English, reply in English.
- If the customer writes in Bangla, reply in Bangla.

PRODUCT CATALOG:
${productCatalog}

YOUR JOB:
- Answer product questions, prices, availability, delivery.
- If a customer sends a product image, match it with catalog products.
- Always mention the price (৳) when discussing products.
- Be warm, friendly, helpful like a real shop assistant.
- If you can't find a matching product, politely ask for more details.
- Keep responses concise but informative. Use emojis naturally 😊
- When a customer wants to order, ask for: name, phone, address, and confirm items.
- If the customer confirms an order, summarize: items, total price, delivery info.

${settings.custom_instructions || ""}

IMPORTANT: You are chatting on Facebook Messenger. Keep messages short and conversational. Don't use markdown formatting.`;

  const historyWithoutLast = chatHistory.slice(0, -1);

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: systemPrompt }, ...historyWithoutLast, currentUserMessage],
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI Gateway error:", aiResponse.status, errText);
    throw new Error("AI error");
  }

  const aiData = await aiResponse.json();
  return aiData.choices?.[0]?.message?.content || settings.welcome_message || "ধন্যবাদ! আপনার মেসেজ পেয়েছি।";
}

async function detectAndCreateOrder(
  supabase: any, apiKey: string, conversationId: string,
  customerMessage: string | null, aiReply: string
) {
  if (!customerMessage) return;
  
  // Simple heuristic: check if the conversation looks like an order confirmation
  const orderKeywords = ["order", "অর্ডার", "কিনতে", "নিব", "দিন", "চাই", "confirm", "buy", "purchase"];
  const lowerMsg = customerMessage.toLowerCase();
  const hasOrderIntent = orderKeywords.some(kw => lowerMsg.includes(kw));
  
  if (!hasOrderIntent) return;

  try {
    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Extract order details from this conversation. If there's a clear order being placed, extract items and details. If it's just inquiry, return null." },
          { role: "user", content: `Customer: ${customerMessage}\nBot reply: ${aiReply}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_order",
            description: "Create an order if the customer is clearly placing one",
            parameters: {
              type: "object",
              properties: {
                is_order: { type: "boolean", description: "true if customer is placing an order" },
                items: { type: "array", items: { type: "object", properties: { name: { type: "string" }, quantity: { type: "number" }, price: { type: "number" } }, required: ["name", "quantity", "price"] } },
                total: { type: "number" },
                customer_name: { type: "string" },
                customer_phone: { type: "string" },
                customer_address: { type: "string" },
              },
              required: ["is_order"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_order" } },
      }),
    });

    if (!extractResponse.ok) return;
    const extractData = await extractResponse.json();
    const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return;

    const orderData = JSON.parse(toolCall.function.arguments);
    if (!orderData.is_order) return;

    await supabase.from("orders").insert({
      conversation_id: conversationId,
      customer_name: orderData.customer_name || null,
      customer_phone: orderData.customer_phone || null,
      customer_address: orderData.customer_address || null,
      items: orderData.items || [],
      total: orderData.total || 0,
      status: "pending",
    });
    console.log("Order created for conversation:", conversationId);
  } catch (e) {
    console.error("Order detection error:", e);
  }
}
