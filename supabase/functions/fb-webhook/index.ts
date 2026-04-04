import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify token is now per-page, stored in fb_pages table

const IMAGE_REQUEST_KEYWORDS = [
  "pic", "picture", "photo", "image", "photos", "images",
  "ছবি", "পিক", "ফটো", "ইমেজ", "দেখাও", "দেখি", "পিক দাও", "ছবি দাও",
  "send pic", "send picture", "show pic", "show picture", "show image",
  "dekhi", "dekhao", "chobi", "picture dekhi",
];

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

    if (mode === "subscribe" && token) {
      // Look up any fb_page with this verify_token
      const { data: matchingPage } = await supabase
        .from("fb_pages")
        .select("id")
        .eq("verify_token", token)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (matchingPage) {
        console.log("Webhook verified for page:", matchingPage.id);
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }
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

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

      for (const entry of body.entry || []) {
        const pageId = entry.id;

        // Look up which user owns this FB page
        const { data: fbPage } = await supabase
          .from("fb_pages")
          .select("user_id, page_access_token, is_active")
          .eq("fb_page_id", pageId)
          .eq("is_active", true)
          .maybeSingle();

        if (!fbPage) {
          // Fallback to global token for backward compatibility
          const fallbackToken = Deno.env.get("FB_PAGE_ACCESS_TOKEN");
          if (!fallbackToken) {
            console.error("No fb_page found for page_id:", pageId, "and no fallback token");
            continue;
          }
          // Try to find any active fb_page to get the user_id
          const { data: anyPage } = await supabase
            .from("fb_pages")
            .select("user_id")
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          const fallbackUserId = anyPage?.user_id || null;
          const fallbackSettings = fallbackUserId ? await loadSettings(supabase, fallbackUserId) : {};
          console.log("Using fallback token with user_id:", fallbackUserId);
          for (const event of entry.messaging || []) {
            await handleMessagingEvent(supabase, event, pageId, fallbackToken, LOVABLE_API_KEY, fallbackSettings, fallbackUserId);
          }
          continue;
        }

        const PAGE_ACCESS_TOKEN = fbPage.page_access_token;
        const userId = fbPage.user_id;

        // Load user-specific settings
        const settings = await loadSettings(supabase, userId);

        // Handle messaging events (DMs)
        for (const event of entry.messaging || []) {
          await handleMessagingEvent(supabase, event, pageId, PAGE_ACCESS_TOKEN, LOVABLE_API_KEY, settings, userId);
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

async function loadSettings(supabase: any, userId: string | null): Promise<Record<string, string>> {
  let query = supabase.from("bot_settings").select("setting_key, setting_value");
  if (userId) {
    query = query.eq("user_id", userId);
  }
  const { data: settingsRows } = await query;
  const settings: Record<string, string> = {};
  settingsRows?.forEach((s: any) => { settings[s.setting_key] = s.setting_value; });
  return settings;
}

// ---- Comment Handler ----

async function handleCommentEvent(
  supabase: any, value: any, pageAccessToken: string, settings: Record<string, string>
) {
  if (settings.comment_auto_reply !== "true") return;
  if (value.from?.id === value.post_id?.split("_")[0]) return;

  const commentId = value.comment_id;
  if (!commentId) return;

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
    }
  } catch (e) {
    console.error("Comment reply failed:", e);
  }
}

// ---- Messaging Handler ----

async function handleMessagingEvent(
  supabase: any, event: any, pageId: string,
  pageAccessToken: string, lovableApiKey: string | undefined,
  settings: Record<string, string>, userId: string | null
) {
  const senderId = event.sender?.id;
  if (!senderId) return;
  if (senderId === pageId) return;
  if (!event.message) return;
  if (event.message.is_echo) return;

  const messageText = event.message.text;
  const attachments = event.message.attachments;
  const fbMessageId = event.message?.mid || null;

  // Get or create conversation (with user_id)
  const conversationId = await getOrCreateConversation(supabase, senderId, pageAccessToken, userId);
  if (!conversationId) return;

  let imageUrl: string | null = null;
  if (attachments) {
    const imageAttachment = attachments.find((a: any) => a.type === "image");
    if (imageAttachment) imageUrl = imageAttachment.payload?.url || null;
  }

  // Save incoming message with DB-level idempotency guard (prevents duplicate replies)
  const { error: incomingInsertError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    fb_message_id: fbMessageId,
    direction: "incoming",
    content: messageText || (imageUrl ? "[Image]" : null),
    image_url: imageUrl,
    user_id: userId,
  });

  if (incomingInsertError) {
    if (fbMessageId && incomingInsertError.code === "23505") {
      console.log("Duplicate incoming message ignored:", fbMessageId);
      return;
    }

    console.error("Failed to save incoming message:", incomingInsertError);
    return;
  }

  await supabase.from("conversations").update({
    last_message: messageText || "[Image]",
    last_message_at: new Date().toISOString(),
  }).eq("id", conversationId);

  // Check auto-reply rules (user-specific)
  const autoReply = await checkAutoReplyRules(supabase, messageText, userId);
  if (autoReply) {
    await sendFbMessage(pageAccessToken, senderId, autoReply);
    await saveOutgoingMessage(supabase, conversationId, autoReply, null, userId);
    return;
  }

  // Handle picture requests
  const imageRequestHandled = await handleProductImageRequest(
    supabase, conversationId, senderId, pageAccessToken, messageText, userId
  );
  if (imageRequestHandled) return;

  // Check credit balance before AI reply
  if (userId) {
    const { data: creditRow } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    const balance = creditRow?.balance ?? 0;
    if (balance <= 0) {
      const noCreditsMsg = settings.no_credits_message || "দুঃখিত, এই মুহূর্তে আমাদের বট সেবা বন্ধ আছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।";
      await sendFbMessage(pageAccessToken, senderId, noCreditsMsg);
      await saveOutgoingMessage(supabase, conversationId, noCreditsMsg, null, userId);
      return;
    }
  }

  // AI-powered response
  if (lovableApiKey) {
    try {
      const hasImage = !!imageUrl;
      const replyText = await generateAiReply(
        supabase, lovableApiKey, conversationId, messageText, imageUrl, settings, userId
      );

      // Detect if AI reply mentions a specific product — send its image first
      let productQuery = supabase.from("products").select("name, name_bn, price, image_url, color, keywords").eq("is_active", true).not("image_url", "is", null);
      if (userId) productQuery = productQuery.eq("user_id", userId);
      const { data: allProducts } = await productQuery;
      
      const mentionedProduct = findMentionedProduct(allProducts || [], replyText, messageText);
      if (mentionedProduct?.image_url) {
        await sendFbImage(pageAccessToken, senderId, mentionedProduct.image_url);
        await saveOutgoingMessage(supabase, conversationId, `[${mentionedProduct.name}]`, mentionedProduct.image_url, userId);
      }

      await sendFbMessage(pageAccessToken, senderId, replyText);
      await saveOutgoingMessage(supabase, conversationId, replyText, null, userId);

      // Deduct credits
      if (userId) {
        const costPerText = Number(settings.credit_cost_text) || 0.30;
        const costPerImage = Number(settings.credit_cost_image) || 1.50;
        const deduction = hasImage ? costPerImage : costPerText;
        await deductCredits(supabase, userId, deduction, hasImage ? "image_reply" : "text_reply");
      }

      await detectAndProcessOrder(supabase, lovableApiKey, conversationId, messageText, replyText, userId);
      await detectAndCreateComplaint(supabase, lovableApiKey, conversationId, senderId, pageAccessToken, messageText, replyText, userId);
    } catch (aiError) {
      console.error("AI processing error:", aiError);
      const fallback = settings.welcome_message || "ধন্যবাদ! আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।";
      await sendFbMessage(pageAccessToken, senderId, fallback);
    }
  }
}

// ---- Helper Functions ----

async function getOrCreateConversation(
  supabase: any, senderId: string, pageAccessToken: string, userId: string | null
): Promise<string | null> {
  let query = supabase.from("conversations").select("id").eq("fb_sender_id", senderId);
  if (userId) query = query.eq("user_id", userId);
  const { data: existingConvo } = await query.maybeSingle();

  // Always try to fetch sender name from FB profile
  let senderName = null;
  try {
    const profileRes = await fetch(
      `https://graph.facebook.com/${senderId}?fields=first_name,last_name&access_token=${pageAccessToken}`
    );
    const profile = await profileRes.json();
    if (profile.first_name || profile.last_name) {
      senderName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    }
    console.log("FB profile for", senderId, ":", JSON.stringify(profile));
  } catch (e) {
    console.error("FB profile fetch error:", e);
  }

  if (existingConvo) {
    // Update sender_name if we got one and it's currently missing
    if (senderName) {
      await supabase.from("conversations").update({ sender_name: senderName }).eq("id", existingConvo.id);
    }
    return existingConvo.id;
  }

  const insertData: any = { fb_sender_id: senderId, sender_name: senderName };
  if (userId) insertData.user_id = userId;

  const { data: newConvo, error } = await supabase
    .from("conversations").insert(insertData).select("id").single();
  if (error) { console.error("Error creating conversation:", error); return null; }
  return newConvo.id;
}

async function checkAutoReplyRules(supabase: any, messageText: string | null, userId: string | null): Promise<string | null> {
  if (!messageText) return null;
  let query = supabase.from("auto_reply_rules").select("*").eq("is_active", true).order("priority", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data: rules } = await query;

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

async function handleProductImageRequest(
  supabase: any, conversationId: string, senderId: string,
  pageAccessToken: string, messageText: string | null, userId: string | null
): Promise<boolean> {
  if (!messageText || !isImageRequestMessage(messageText)) return false;

  const matchedProduct = await findBestProductForImageRequest(supabase, conversationId, messageText, userId);
  const isBangla = /[\u0980-\u09FF]/.test(messageText);

  if (!matchedProduct?.image_url) {
    const askProductName = isBangla
      ? "যে প্রোডাক্টের ছবি চান, নামটা লিখে দিন — সাথে সাথে ছবি পাঠাচ্ছি।"
      : "Please tell me the product name, and I'll send the picture right away.";
    await sendFbMessage(pageAccessToken, senderId, askProductName);
    await saveOutgoingMessage(supabase, conversationId, askProductName, null, userId);
    return true;
  }

  const productName = matchedProduct.name_bn || matchedProduct.name;
  const caption = isBangla
    ? `${productName} — ৳${matchedProduct.price}। আর কোন রং দেখবেন?`
    : `${matchedProduct.name} — ৳${matchedProduct.price}. Want to see another color?`;

  await sendFbImage(pageAccessToken, senderId, matchedProduct.image_url);
  await sendFbMessage(pageAccessToken, senderId, caption);
  await saveOutgoingMessage(supabase, conversationId, caption, matchedProduct.image_url, userId);
  return true;
}

function isImageRequestMessage(messageText: string): boolean {
  const lower = messageText.toLowerCase();
  return IMAGE_REQUEST_KEYWORDS.some((keyword) => lower.includes(keyword));
}

async function findBestProductForImageRequest(
  supabase: any, conversationId: string, messageText: string, userId: string | null
) {
  let query = supabase
    .from("products")
    .select("name, name_bn, price, image_url, keywords, color")
    .eq("is_active", true)
    .not("image_url", "is", null);
  if (userId) query = query.eq("user_id", userId);
  const { data: products } = await query;

  if (!products?.length) return null;

  const { data: recentMessages } = await supabase
    .from("messages")
    .select("content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(12);

  const context = [
    messageText,
    ...(recentMessages || []).map((m: any) => m.content || ""),
  ].join(" ").toLowerCase();

  let best: any = null;
  let bestScore = 0;

  for (const product of products) {
    const terms = [
      product.name,
      product.name_bn,
      product.color,
      ...((product.keywords || []) as string[]),
    ]
      .filter(Boolean)
      .map((t: string) => t.toLowerCase().trim())
      .filter((t: string) => t.length > 1);

    let score = 0;
    for (const term of terms) {
      if (context.includes(term)) score += term.length >= 4 ? 2 : 1;
    }

    if (score > bestScore) {
      best = product;
      bestScore = score;
    }
  }

  if (best) return best;
  if (products.length === 1) return products[0];
  return null;
}

function findMentionedProduct(products: any[], aiReply: string, customerMsg: string | null): any | null {
  if (!products?.length) return null;
  const combined = `${aiReply} ${customerMsg || ""}`.toLowerCase();
  
  let best: any = null;
  let bestScore = 0;

  for (const p of products) {
    const terms = [
      p.name, p.name_bn, p.color,
      ...((p.keywords || []) as string[]),
    ].filter(Boolean).map((t: string) => t.toLowerCase().trim()).filter((t: string) => t.length > 1);

    let score = 0;
    for (const term of terms) {
      if (combined.includes(term)) score += term.length >= 4 ? 3 : 1;
    }
    // Boost if price is mentioned in the reply
    if (score > 0 && aiReply.includes(String(p.price))) score += 2;

    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }

  return bestScore >= 2 ? best : null;
}

async function sendFbMessage(pageAccessToken: string, recipientId: string, text: string) {
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
}

async function sendFbImage(pageAccessToken: string, recipientId: string, imageUrl: string) {
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "image",
          payload: { url: imageUrl, is_reusable: true },
        },
      },
    }),
  });
}

async function saveOutgoingMessage(
  supabase: any, conversationId: string, content: string,
  imageUrl: string | null = null, userId: string | null = null
) {
  const insertData: any = {
    conversation_id: conversationId,
    direction: "outgoing",
    content,
    image_url: imageUrl,
  };
  if (userId) insertData.user_id = userId;

  await supabase.from("messages").insert(insertData);
  await supabase.from("conversations").update({
    last_message: content || (imageUrl ? "[Image]" : null),
    last_message_at: new Date().toISOString(),
  }).eq("id", conversationId);
}

function parseMaxSentences(maxReplyLength?: string): number {
  if (!maxReplyLength) return 4;
  const match = maxReplyLength.match(/\d+/);
  if (!match) return 4;
  const parsed = Number.parseInt(match[0], 10);
  if (Number.isNaN(parsed)) return 4;
  return Math.min(Math.max(parsed, 1), 6);
}

function sanitizeReplyText(reply: string, maxReplyLength?: string): string {
  const maxSentences = parseMaxSentences(maxReplyLength);

  const normalized = reply
    .replace(/\[[^\]]*image[^\]]*\]/gi, "")
    .replace(/technical problem/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  const segments = normalized
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    const key = segment
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "")
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(segment);
  }

  return unique.slice(0, maxSentences).join(" ").trim();
}

async function generateAiReply(
  supabase: any, apiKey: string, conversationId: string,
  messageText: string | null, imageUrl: string | null,
  settings: Record<string, string>, userId: string | null
): Promise<string> {
  const { data: recentMessages } = await supabase
    .from("messages").select("direction, content, image_url")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(20);

  let productQuery = supabase
    .from("products").select("name, name_bn, description, description_bn, price, category, keywords, image_url, color, size, material")
    .eq("is_active", true);
  if (userId) productQuery = productQuery.eq("user_id", userId);
  const { data: products } = await productQuery;

  const productCatalog = products?.map((p: any) =>
    `- ${p.name}${p.name_bn ? ` (${p.name_bn})` : ""}: ৳${p.price}${p.color ? ` | Color: ${p.color}` : ""}${p.size ? ` | Size: ${p.size}` : ""}${p.material ? ` | Material: ${p.material}` : ""}${p.description ? ` — ${p.description}` : ""}${p.category ? ` [${p.category}]` : ""}${p.keywords?.length ? ` [${p.keywords.join(", ")}]` : ""}`
  ).join("\n") || "No products available.";

  const chatHistory = (recentMessages || []).reverse().map((m: any) => ({
    role: m.direction === "incoming" ? "user" as const : "assistant" as const,
    content: m.image_url && m.direction === "incoming"
      ? [{ type: "text" as const, text: m.content || "Customer sent an image" }, { type: "image_url" as const, image_url: { url: m.image_url } }]
      : m.content || "",
  }));

  const hasImage = !!imageUrl;

  // Build product image references
  const productsWithImages = products?.filter((p: any) => p.image_url) || [];
  const productImageList = productsWithImages
    .map((p: any) => `${p.name}${p.name_bn ? ` (${p.name_bn})` : ""} [${p.category || 'uncategorized'}] — ৳${p.price}`)
    .join("\n") || "";

  // When customer sends an image, include product images so AI can visually compare
  let currentUserMessage: any;
  if (imageUrl) {
    const contentParts: any[] = [];

    // Add instruction text
      const imageAnalysisPrompt = messageText
        ? `Customer said: "${messageText}" and sent an image. Compare it visually with our product images below. If the customer's image matches any product (same type + similar color/design), tell the name and price. If no exact match, suggest the closest similar product from our catalog with its price. Keep reply 1-2 sentences max.`
        : `Customer sent this image. Compare it visually with our product images below. If it matches any product, tell the name and price. If no exact match, suggest the closest similar product from our catalog with its price. Keep reply 1-2 sentences max.`;

    contentParts.push({ type: "text", text: imageAnalysisPrompt });

    // Add customer's image
    contentParts.push({ type: "text", text: "CUSTOMER'S IMAGE:" });
    contentParts.push({ type: "image_url", image_url: { url: imageUrl } });

    // Add product images for visual comparison (limit to 10 to stay within token limits)
    if (productsWithImages.length > 0) {
      contentParts.push({ type: "text", text: "OUR PRODUCT IMAGES (compare customer's image against these):" });
      for (const p of productsWithImages.slice(0, 10)) {
        contentParts.push({
          type: "text",
          text: `Product: ${p.name}${p.name_bn ? ` (${p.name_bn})` : ""} — ৳${p.price}`
        });
        contentParts.push({ type: "image_url", image_url: { url: p.image_url } });
      }
    }

    currentUserMessage = { role: "user", content: contentParts };
  } else {
    currentUserMessage = { role: "user", content: messageText || "" };
  }

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

  // Detect if customer's current message is in English
  const isCurrentMsgEnglish = messageText ? !/[\u0980-\u09FF]/.test(messageText) && /^[a-zA-Z0-9\s.,!?'"@#$%^&*()_+\-=\[\]{};:\\|<>\/~`]+$/.test(messageText.trim()) : false;
  // Also check Banglish (Latin script Bangla like "ki korben", "daam koto")
  const banglishPatterns = /\b(ki|koto|kemon|ache|nai|den|dao|korbo|hobe|lagbe|chai|bhai|vai|apu|apa|dada|didi|niben|diben|dekhao|dekhi|bolun|bolben|pathaen|pathao|order|korte|korben|price|dam|daam|shob|gula|gulo|ta|ti|er|theke)\b/i;
  const isBanglish = messageText ? banglishPatterns.test(messageText) : false;
  // If message has Bangla script OR is Banglish, reply in Bangla
  const shouldReplyBangla = !isCurrentMsgEnglish || isBanglish;

  const systemPrompt = `#############################
# LANGUAGE RULE — HIGHEST PRIORITY — MUST FOLLOW BEFORE ANYTHING ELSE
#############################
${shouldReplyBangla
  ? `YOU MUST REPLY IN BANGLA (বাংলা). This is NON-NEGOTIABLE.
- Every single word of your reply MUST be in Bangla script (বাংলা).
- Do NOT reply in English even if you think it would be easier.
- If the customer wrote in Banglish (Bangla using English letters like "ki dam", "ache ki"), you STILL reply in Bangla script (বাংলা).
- Product names can stay in English if needed, but everything else MUST be Bangla.
- Example: Customer says "ki dam" → You reply "দাম ৳500 😊" NOT "The price is 500 taka"`
  : `The customer wrote in English, so reply in English. Keep it natural and friendly.`}
#############################

${settings.ai_personality || `You are "${settings.bot_name || "Fast Rep"}", the friendly sales assistant for "${settings.business_name || "our shop"}" on Facebook Messenger.`}
${settings.business_description ? `\nBusiness: ${settings.business_description}` : ""}
${settings.reply_tone ? `\nTone: ${settings.reply_tone}` : ""}

#############################
# REPLY LENGTH — ABSOLUTE RULE
#############################
- MAX 1-2 sentences per reply. NEVER more than 3 sentences.
- Be DIRECT. Answer the question, give the info, done.
- Do NOT over-explain, do NOT repeat what customer already said back to them.
- Do NOT use filler phrases like "আহা কী দারুণ!", "বাহ!", "চমৎকার!", "That's amazing!".
- Do NOT flatter the customer. Just answer their question.
- Do NOT narrate what the customer is doing ("আপনি ৫ ধরনের কালার চয়েস করছেন" — NO).
- Stick to the POINT. Customer asks price → give price. Customer asks availability → say yes/no.
- Think like a busy shopkeeper — efficient, helpful, no unnecessary words.

BAD REPLY EXAMPLE (TOO LONG, TOO FLATTERING):
"আহা আপু, কী দারুণ বুদ্ধি! 👍 ৫০০ পিস নিচ্ছেন, সাথে ৫ ধরনের কালার চয়েস করছেন, এটা তো কাস্টমারদের জন্য দারুণ হবে! আমি আপনার জন্য এই মেরুন কালারসহ আরও যে যে সুন্দর কালারগুলো আমাদের কাছে আছে, সেগুলোর একটা লিস্ট বা ছবি পাঠাতে পারি।"

GOOD REPLY EXAMPLE (SHORT, DIRECT):
"জি আপু, মেরুন সহ আমাদের ৫টা কালার আছে। লিস্ট পাঠাচ্ছি 😊"

${settings.emoji_style ? `Emoji: ${settings.emoji_style}` : "Use max 1 emoji per reply. Not every reply needs an emoji."}

LANGUAGE DETAILS:
- Use "ভাই/আপু" naturally. Use "আপনি" for respect.
- Understand Banglish: "ki dam" = "কত দাম", "ache ki" = "আছে কি"

PRODUCT CATALOG:
${productCatalog}

CONTEXT RULES:
- Read conversation history. Don't repeat info already given.
- Don't say the same thing in different words.
- If you already told the price, don't tell it again unless asked.
${settings.angry_customer_handling ? `\nANGRY CUSTOMERS: ${settings.angry_customer_handling}` : ""}

${settings.image_instructions || `IMAGE HANDLING:
- When customer sends an image, you will receive both their image AND our product images.
- VISUALLY compare: same item type (t-shirt/hijab/sharee etc) AND similar color/design = match.
- Match found → say product name + price in 1 sentence.
- No exact match → suggest the closest similar product we have. Say something like "এটার মতো আমাদের [product name] আছে, দাম ৳X" or ask what they're looking for.
- NEVER say "এটা আমাদের কালেকশনে নেই" or "not in our collection." Always try to help.
- Be precise about item types. Don't confuse t-shirt with hijab.`}

${settings.order_instructions || `ORDER COLLECTION — VERY IMPORTANT:
- When customer wants to order, you MUST collect ALL of these before confirming:
  1. Full name (নাম)
  2. Phone number (ফোন নম্বর)
  3. Full delivery address (ঠিকানা)
  4. Which product(s) they want (পণ্যের নাম)
  5. Quantity of each product (কয়টা)
- Ask for missing info one step at a time. Do NOT confirm until ALL details are collected.
- Once you have everything, summarize: "নাম: X, ফোন: X, ঠিকানা: X, পণ্য: X (Xটা), মোট: ৳X — কনফার্ম করবেন?"
- Only after customer says "হ্যাঁ/yes/confirm/কনফার্ম" should the order be considered confirmed.
- Do NOT say "অর্ডার কনফার্ম" until customer explicitly confirms the summary.`}
${settings.delivery_info ? `Delivery: ${settings.delivery_info}` : ""}
${settings.payment_methods ? `Payment: ${settings.payment_methods}` : ""}

FINAL RULES:
- NEVER repeat yourself. If you said it before, don't say it again.
- NEVER use markdown, bullet points, or formatting. Plain text only.
- NEVER write "[Image]" placeholders.
- If unsure, say so honestly. Don't make up info.
- Answer → done. Don't add unnecessary follow-up questions every time.
${neverSaySection}
${settings.custom_instructions || ""}
${examplesSection}
${faqSection}`;


  const historyWithoutLast = chatHistory.slice(0, -1);

  const requestBody: any = {
    model: "google/gemini-2.5-flash",
    messages: [{ role: "system", content: systemPrompt }, ...historyWithoutLast, currentUserMessage],
  };

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI Gateway error:", aiResponse.status, errText);
    throw new Error("AI error");
  }

  const aiData = await aiResponse.json();
  const rawReply = aiData.choices?.[0]?.message?.content || "";
  const cleanedReply = sanitizeReplyText(rawReply, settings.max_reply_length);

  // Log AI usage
  const callType = hasImage ? "image" : "text";
  const estimatedCost = hasImage ? 0.003 : 0.0005;
  await logAiUsage(supabase, userId, callType, "google/gemini-2.5-flash", estimatedCost);

  return cleanedReply || settings.welcome_message || "ধন্যবাদ! আপনার মেসেজ পেয়েছি।";
}

async function detectAndProcessOrder(
  supabase: any, apiKey: string, conversationId: string,
  customerMessage: string | null, aiReply: string, userId: string | null
) {
  if (!customerMessage) return;

  // Broader keyword set: covers new orders, modifications, and cancellations
  const orderKeywords = [
    "order", "অর্ডার", "কিনতে", "নিব", "দিন", "চাই", "confirm", "confirmed", "confirmation",
    "buy", "purchase", "book", "ok", "okay", "yes", "হ্যাঁ", "হ্যা", "জি", "ঠিক আছে", "done",
    "কনফার্ম", "নিতে", "লাগবে", "দরকার", "korbo", "nibo", "chai", "lagbe",
    // Modification keywords
    "আরো", "aro", "more", "add", "যোগ", "change", "পরিবর্তন", "update", "বাড়াও", "কমাও",
    "another", "extra", "সাথে", "sathe", "আরেকটা", "arekta",
    // Cancellation keywords
    "cancel", "বাতিল", "batil", "remove", "মুছে", "না চাই", "na chai", "don't want",
    "চাই না", "লাগবে না", "lagbe na", "বাদ", "bad", "রাখবো না", "রাখব না",
  ];
  const lowerMsg = customerMessage.toLowerCase();
  const hasOrderIntent = orderKeywords.some(kw => lowerMsg.includes(kw));

  if (!hasOrderIntent) return;

  try {
    // Fetch conversation history
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("direction, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(40);

    const transcript = (recentMessages || [])
      .map((m: any) => `${m.direction === "incoming" ? "Customer" : "Bot"}: ${m.content || ""}`)
      .join("\n");

    // Fetch products for price lookup
    let productQuery = supabase.from("products").select("name, name_bn, price").eq("is_active", true);
    if (userId) productQuery = productQuery.eq("user_id", userId);
    const { data: products } = await productQuery;
    const productList = (products || []).map((p: any) => `${p.name}${p.name_bn ? ` (${p.name_bn})` : ""}: ৳${p.price}`).join(", ");

    // Check if there's already an existing order for this conversation
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, status, items, total, customer_name, customer_phone, customer_address")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const existingOrderInfo = existingOrder
      ? `\n\nEXISTING ORDER (already in system):\n- Status: ${existingOrder.status}\n- Items: ${JSON.stringify(existingOrder.items)}\n- Total: ৳${existingOrder.total}\n- Name: ${existingOrder.customer_name || "N/A"}\n- Phone: ${existingOrder.customer_phone || "N/A"}\n- Address: ${existingOrder.customer_address || "N/A"}`
      : "\n\nNo existing order for this conversation.";

    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: `You are an order management AI for a Facebook Messenger shop. Read the FULL conversation and determine what action to take.

AVAILABLE ACTIONS:
1. "new_order" — Customer is placing a new order with details
2. "update_order" — Customer wants to ADD more items, CHANGE quantity, or MODIFY an existing order
3. "cancel_order" — Customer wants to CANCEL their order
4. "no_action" — No order-related action needed

PRODUCT PRICES: ${productList}
${existingOrderInfo}

RULES FOR "new_order":
- Customer must have shown intent to buy AND provided details (name, phone, address) somewhere in the conversation
- "ok", "yes", "confirm", "done", "জি", "হ্যাঁ" after bot summary = confirmed order
- "ager details e" or "same details" = reuse details from earlier messages
- Short addresses like "49/4" or "Mirpur 10" are valid
- Phone starting with 01 (11 digits) is valid
- Calculate total = sum of (item price × quantity)

RULES FOR "update_order":
- Only if an existing order already exists
- Customer says things like "আরো 2টা দিন", "add 1 more", "change to 3", "সাথে আরেকটা", "I want 2 more"
- Merge new items with existing items. If same product, update quantity. If new product, add it.
- Keep existing customer details unless customer provides new ones
- Recalculate total after changes

RULES FOR "cancel_order":
- Customer clearly says cancel/বাতিল/don't want/চাই না/লাগবে না
- Only if an existing order exists

RULES FOR "no_action":
- Customer is just asking questions, browsing, or chatting — not ordering
- Details are too incomplete (no items identified)` },
          { role: "user", content: `Full Conversation:\n${transcript}\n\nLatest customer message: "${customerMessage}"\nBot's reply: "${aiReply}"` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "process_order",
            description: "Process order action based on conversation",
            parameters: {
              type: "object",
              properties: {
                action: { type: "string", enum: ["new_order", "update_order", "cancel_order", "no_action"], description: "What action to take" },
                items: { type: "array", description: "FULL updated list of items (for new_order and update_order)", items: { type: "object", properties: { name: { type: "string" }, quantity: { type: "number" }, price: { type: "number" } }, required: ["name", "quantity", "price"] } },
                total: { type: "number", description: "Total price after all changes" },
                customer_name: { type: "string" },
                customer_phone: { type: "string" },
                customer_address: { type: "string" },
                cancel_reason: { type: "string", description: "Why customer is cancelling (if cancel_order)" },
              },
              required: ["action"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "process_order" } },
      }),
    });

    if (!extractResponse.ok) {
      const errText = await extractResponse.text();
      console.error("Order extraction API error:", extractResponse.status, errText);
      return;
    }
    const extractData = await extractResponse.json();

    await logAiUsage(supabase, userId, "order_detection", "google/gemini-2.5-flash-lite", 0.0002);

    const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.log("No tool call in order extraction response");
      return;
    }

    const orderData = JSON.parse(toolCall.function.arguments);
    console.log("Order action:", orderData.action, "Data:", JSON.stringify(orderData));

    // ---- CANCEL ORDER ----
    if (orderData.action === "cancel_order") {
      if (!existingOrder) {
        console.log("Cancel requested but no existing order found");
        return;
      }
      const { error } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          notes: orderData.cancel_reason || "Cancelled by customer via Messenger",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingOrder.id);

      if (error) console.error("Failed to cancel order:", error);
      else console.log("Order cancelled:", existingOrder.id);
      return;
    }

    // ---- NO ACTION ----
    if (orderData.action === "no_action") {
      console.log("No order action needed");
      return;
    }

    // ---- NEW ORDER or UPDATE ORDER ----
    const hasItems = Array.isArray(orderData.items) && orderData.items.length > 0;
    if (!hasItems) {
      console.log("No items found, skipping order action");
      return;
    }

    // Auto-fill prices from product catalog
    if (products?.length) {
      for (const item of orderData.items) {
        if (!item.price || item.price <= 0) {
          const match = products.find((p: any) =>
            p.name.toLowerCase().includes(item.name.toLowerCase()) ||
            item.name.toLowerCase().includes(p.name.toLowerCase()) ||
            (p.name_bn && item.name.includes(p.name_bn))
          );
          if (match) item.price = match.price;
        }
      }
    }

    // Calculate total
    let total = orderData.items.reduce((sum: number, i: any) => sum + (i.price || 0) * (i.quantity || 1), 0);
    if (orderData.total && orderData.total > 0) total = orderData.total;

    // Get customer details — prefer new data, fall back to existing order
    const customerName = orderData.customer_name?.trim() || existingOrder?.customer_name || null;
    const customerPhone = orderData.customer_phone?.trim() || existingOrder?.customer_phone || null;
    const customerAddress = orderData.customer_address?.trim() || existingOrder?.customer_address || null;

    // For new orders, require items + at least 2 customer details
    if (orderData.action === "new_order") {
      const detailCount = [!!customerName, !!customerPhone, !!customerAddress].filter(Boolean).length;
      if (detailCount < 2) {
        console.log("New order details insufficient:", { name: !!customerName, phone: !!customerPhone, address: !!customerAddress });
        return;
      }
    }

    const upsertData: any = {
      conversation_id: conversationId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      items: orderData.items,
      total: total,
      status: "confirmed",
      updated_at: new Date().toISOString(),
    };
    if (userId) upsertData.user_id = userId;

    if (existingOrder) {
      // UPDATE existing order (modification or re-confirmation)
      const { error } = await supabase
        .from("orders")
        .update(upsertData)
        .eq("id", existingOrder.id);

      if (error) {
        console.error("Failed to update order:", error);
        return;
      }
      console.log(`Order ${orderData.action === "update_order" ? "updated" : "confirmed"}:`, existingOrder.id, "Items:", JSON.stringify(orderData.items), "Total:", total);
    } else {
      // INSERT new order
      const { error } = await supabase.from("orders").insert(upsertData);
      if (error) {
        console.error("Failed to create order:", error);
        return;
      }
      console.log("New order created. Items:", JSON.stringify(orderData.items), "Total:", total);
    }
  } catch (e) {
    console.error("Order processing error:", e);
  }
}

async function logAiUsage(
  supabase: any, userId: string | null, callType: string, model: string, estimatedCost: number
) {
  if (!userId) return;
  try {
    await supabase.from("ai_usage").insert({
      user_id: userId,
      call_type: callType,
      model,
      estimated_cost: estimatedCost,
    });
  } catch (e) {
    console.error("Failed to log AI usage:", e);
  }
}

async function deductCredits(
  supabase: any, userId: string, amount: number, type: string
) {
  try {
    const { data: creditRow, error: selectErr } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (selectErr) { console.error("Credit select error:", selectErr); return; }
    if (!creditRow) { console.error("No credit row found for user:", userId); return; }

    const newBalance = Math.max(0, Number(creditRow.balance) - amount);
    const { error: updateErr } = await supabase
      .from("user_credits")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateErr) { console.error("Credit update error:", updateErr); return; }
    console.log(`Credits deducted: ${amount} for ${type}. Balance: ${creditRow.balance} -> ${newBalance}`);

    // Log as negative transaction
    const { error: insertErr } = await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: -amount,
      type,
      description: type === "image_reply" ? "AI image analysis" : "AI text reply",
    });
    if (insertErr) console.error("Credit transaction insert error:", insertErr);
  } catch (e) {
    console.error("Failed to deduct credits:", e);
  }
}

async function detectAndCreateComplaint(
  supabase: any, apiKey: string, conversationId: string,
  senderId: string, pageAccessToken: string,
  customerMessage: string | null, aiReply: string, userId: string | null
) {
  if (!customerMessage) return;

  const complaintKeywords = [
    "complaint", "complain", "problem", "issue", "broken", "damaged", "wrong", "bad", "terrible", "worst",
    "অভিযোগ", "সমস্যা", "নষ্ট", "ভাঙ্গা", "খারাপ", "ক্ষতি", "ভুল", "পণ্য ভুল", "ডেমেজ",
    "সমস্যা হচ্ছে", "কাজ করে না", "ফেরত", "return", "refund", "exchange",
    "somossa", "bhangga", "nossto", "kharap", "vul", "damage"
  ];
  const lowerMsg = customerMessage.toLowerCase();
  const hasComplaintIntent = complaintKeywords.some(kw => lowerMsg.includes(kw));

  if (!hasComplaintIntent) return;

  try {
    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Extract complaint details. If customer has a genuine complaint, extract info. Return is_complaint=false if just asking a question." },
          { role: "user", content: `Customer: ${customerMessage}\nBot reply: ${aiReply}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_complaint",
            description: "Create a complaint record",
            parameters: {
              type: "object",
              properties: {
                is_complaint: { type: "boolean" },
                complaint_text: { type: "string", description: "Summary of what went wrong" },
                customer_name: { type: "string" },
                customer_phone: { type: "string" },
              },
              required: ["is_complaint"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_complaint" } },
      }),
    });

    if (!extractResponse.ok) return;
    const extractData = await extractResponse.json();
    await logAiUsage(supabase, userId, "complaint_detection", "google/gemini-2.5-flash-lite", 0.0002);

    const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return;

    const data = JSON.parse(toolCall.function.arguments);
    if (!data.is_complaint) return;

    // If no phone number yet, ask for it
    if (!data.customer_phone) {
      const askPhoneMsg = "আপনার অভিযোগ আমরা নোট করেছি। অনুগ্রহ করে আপনার ফোন নম্বর দিন, আমরা আপনাকে কল দিবো। 📞";
      await sendFbMessage(pageAccessToken, senderId, askPhoneMsg);
      await saveOutgoingMessage(supabase, conversationId, askPhoneMsg, null, userId);
    } else {
      const confirmMsg = "আপনার অভিযোগ রেকর্ড করা হয়েছে। আমরা আপনাকে কল দিবো। ধন্যবাদ। 🙏";
      await sendFbMessage(pageAccessToken, senderId, confirmMsg);
      await saveOutgoingMessage(supabase, conversationId, confirmMsg, null, userId);
    }

    // Save complaint
    const insertData: any = {
      conversation_id: conversationId,
      customer_name: data.customer_name || null,
      customer_phone: data.customer_phone || null,
      complaint_text: data.complaint_text || customerMessage,
      status: "pending",
    };
    if (userId) insertData.user_id = userId;

    await supabase.from("complaints").insert(insertData);
    console.log("Complaint created for conversation:", conversationId);
  } catch (e) {
    console.error("Complaint detection error:", e);
  }
}