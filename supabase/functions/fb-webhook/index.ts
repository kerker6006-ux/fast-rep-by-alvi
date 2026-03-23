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
      console.log("Received webhook:", JSON.stringify(body).slice(0, 500));

      if (body.object !== "page") {
        return new Response("Not a page event", { status: 200, headers: corsHeaders });
      }

      const PAGE_ACCESS_TOKEN = Deno.env.get("FB_PAGE_ACCESS_TOKEN");
      if (!PAGE_ACCESS_TOKEN) {
        console.error("FB_PAGE_ACCESS_TOKEN not set");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

      // Load settings once per request
      const settings = await loadSettings(supabase);

      for (const entry of body.entry || []) {
        // Handle messaging events (DMs)
        for (const event of entry.messaging || []) {
          await handleMessagingEvent(supabase, event, entry.id, PAGE_ACCESS_TOKEN, LOVABLE_API_KEY, settings);
        }

        // Handle feed/comment events
        for (const change of entry.changes || []) {
          if (change.field === "feed" && change.value?.item === "comment") {
            await handleCommentEvent(supabase, change.value, PAGE_ACCESS_TOKEN, settings);
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

// ---- Settings ----

async function loadSettings(supabase: any): Promise<Record<string, string>> {
  const { data: settingsRows } = await supabase.from("bot_settings").select("setting_key, setting_value");
  const settings: Record<string, string> = {};
  settingsRows?.forEach((s: any) => { settings[s.setting_key] = s.setting_value; });
  return settings;
}

// ---- Comment Handler ----

async function handleCommentEvent(
  supabase: any, value: any, pageAccessToken: string, settings: Record<string, string>
) {
  // Skip if comment auto-reply is disabled
  if (settings.comment_auto_reply !== "true") return;

  // Don't reply to own comments
  if (value.from?.id === value.post_id?.split("_")[0]) return;

  const commentId = value.comment_id;
  if (!commentId) return;

  // Detect language of the comment
  const commentText = value.message || "";
  const isBangla = /[\u0980-\u09FF]/.test(commentText);

  const replyText = isBangla
    ? (settings.comment_reply_text || "ধন্যবাদ! বিস্তারিত জানতে আমাদের পেজে ইনবক্স করুন 📩")
    : (settings.comment_reply_text_en || "Thanks! Please inbox us for details 📩");

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${commentId}/comments?access_token=${pageAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      console.error("Comment reply error:", res.status, errText);
    } else {
      console.log("Comment reply sent to:", commentId);
    }
  } catch (e) {
    console.error("Comment reply failed:", e);
  }
}

// ---- Messaging Handler ----

async function handleMessagingEvent(
  supabase: any, event: any, pageId: string,
  pageAccessToken: string, lovableApiKey: string | undefined,
  settings: Record<string, string>
) {
  const senderId = event.sender?.id;
  if (!senderId) return;
  if (senderId === pageId) return;

  // Skip non-message events
  if (!event.message) return;
  // Skip echo messages
  if (event.message.is_echo) return;

  const messageText = event.message.text;
  const attachments = event.message.attachments;

  // Get or create conversation
  const conversationId = await getOrCreateConversation(supabase, senderId, pageAccessToken);
  if (!conversationId) return;

  // Image URL from attachments
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
    await sendFbMessage(pageAccessToken, senderId, autoReply);
    await saveOutgoingMessage(supabase, conversationId, autoReply);
    return;
  }

  // AI-powered response
  if (lovableApiKey) {
    try {
      const replyText = await generateAiReply(
        supabase, lovableApiKey, conversationId, messageText, imageUrl, settings
      );
      await sendFbMessage(pageAccessToken, senderId, replyText);
      await saveOutgoingMessage(supabase, conversationId, replyText);

      // Detect order intent
      await detectAndCreateOrder(supabase, lovableApiKey, conversationId, messageText, replyText);
    } catch (aiError) {
      console.error("AI processing error:", aiError);
      const fallback = settings.welcome_message || "ধন্যবাদ! আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।";
      await sendFbMessage(pageAccessToken, senderId, fallback);
    }
  }
}

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
  messageText: string | null, imageUrl: string | null,
  settings: Record<string, string>
): Promise<string> {
  const { data: recentMessages } = await supabase
    .from("messages").select("direction, content, image_url")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(10);

  const { data: products } = await supabase
    .from("products").select("name, name_bn, description, description_bn, price, category, keywords, image_url")
    .eq("is_active", true);

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

  // Build reply examples section
  let examplesSection = "";
  if (settings.reply_examples) {
    try {
      const examples = JSON.parse(settings.reply_examples);
      if (examples.length > 0) {
        examplesSection = "\n\nREPLY EXAMPLES (follow this exact style):\n" +
          examples.map((ex: any) => `Customer: "${ex.customer}"\nYou reply: "${ex.reply}"${ex.category ? ` [${ex.category}]` : ""}`).join("\n\n");
      }
    } catch {}
  }

  // Build never-say list
  let neverSaySection = "";
  if (settings.never_say_list) {
    try {
      const items = JSON.parse(settings.never_say_list);
      if (items.length > 0) {
        neverSaySection = "\n\nNEVER DO THESE:\n" + items.map((item: string) => `- ❌ ${item}`).join("\n");
      }
    } catch {}
  }
  if (settings.ai_never_say) {
    neverSaySection += `\n${settings.ai_never_say}`;
  }

  // Build FAQ section
  let faqSection = "";
  if (settings.faq_list) {
    try {
      const faqs = JSON.parse(settings.faq_list);
      if (faqs.length > 0) {
        faqSection = "\n\nFAQ KNOWLEDGE BASE (use these for accurate answers):\n" +
          faqs.map((f: any) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
      }
    } catch {}
  }

  const systemPrompt = `${settings.ai_personality || `You are an AI assistant named "${settings.bot_name || "Fast Rep"}" for "${settings.business_name || "a business"}" Facebook page.`}
${settings.business_description ? `\nBusiness: ${settings.business_description}` : ""}
${settings.reply_tone ? `\nTone: ${settings.reply_tone}` : ""}
${settings.max_reply_length ? `\nReply Length: Keep replies ${settings.max_reply_length}` : ""}
${settings.emoji_style ? `\nEmoji: ${settings.emoji_style}` : ""}

LANGUAGE RULES:
- Default language is Bangla (বাংলা). Reply in Bangla by default.
- If the customer writes in English, reply in English.
- Match the customer's language style and formality level.

PRODUCT CATALOG:
${productCatalog}

UNDERSTANDING RULES:
- Deeply analyze every customer message to understand their actual intent, even if they use slang, shorthand, or informal language.
- "দাম কত", "price", "কত" = asking about pricing
- "আছে কি", "available" = asking about availability
- Understand Bangla slang: "bhai", "ভাই", "vai", "apu", "আপু", "bro" etc.
- Detect sentiment — if frustrated, be extra patient. If excited, match their energy.
${settings.angry_customer_handling ? `\nANGRY/FRUSTRATED CUSTOMERS:\n${settings.angry_customer_handling}` : ""}
${settings.after_hours_message ? `\nFALLBACK:\n${settings.after_hours_message}` : ""}

${settings.image_instructions || "IMAGE HANDLING:\n- When customer sends product image, identify it from catalog, share name, price, availability.\n- If no match, describe what you see and ask for clarification."}

${settings.order_instructions || "ORDER HANDLING:\n- When customer wants to order, ask for: name, phone, address, confirm items.\n- Always mention price (৳) and delivery info."}
${settings.delivery_info ? `\nDelivery: ${settings.delivery_info}` : ""}
${settings.payment_methods ? `\nPayment: ${settings.payment_methods}` : ""}

YOUR JOB:
- Answer product questions, prices, availability accurately.
- Always mention the price (৳) when discussing products.
- Be warm, friendly, helpful like a real shop assistant.
- Keep responses concise but informative. Use emojis naturally 😊
- When customer confirms order, summarize: items, total, delivery info.
${neverSaySection}
${settings.custom_instructions || ""}
${examplesSection}
${faqSection}

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
