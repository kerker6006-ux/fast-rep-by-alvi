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
          // Process with fallback (no user_id)
          for (const event of entry.messaging || []) {
            await handleMessagingEvent(supabase, event, pageId, fallbackToken, LOVABLE_API_KEY, {}, null);
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

  // AI-powered response
  if (lovableApiKey) {
    try {
      const replyText = await generateAiReply(
        supabase, lovableApiKey, conversationId, messageText, imageUrl, settings, userId
      );
      await sendFbMessage(pageAccessToken, senderId, replyText);
      await saveOutgoingMessage(supabase, conversationId, replyText, null, userId);

      await detectAndCreateOrder(supabase, lovableApiKey, conversationId, messageText, replyText, userId);
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

  if (existingConvo) return existingConvo.id;

  let senderName = null;
  try {
    const profileRes = await fetch(
      `https://graph.facebook.com/${senderId}?fields=first_name,last_name&access_token=${pageAccessToken}`
    );
    const profile = await profileRes.json();
    senderName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || null;
  } catch {}

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
    .select("name, name_bn, price, image_url, keywords")
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
    .from("products").select("name, name_bn, description, description_bn, price, category, keywords, image_url")
    .eq("is_active", true);
  if (userId) productQuery = productQuery.eq("user_id", userId);
  const { data: products } = await productQuery;

  const productCatalog = products?.map((p: any) =>
    `- ${p.name}${p.name_bn ? ` (${p.name_bn})` : ""}: ৳${p.price}${p.description ? ` — ${p.description}` : ""}${p.category ? ` [${p.category}]` : ""}${p.keywords?.length ? ` [${p.keywords.join(", ")}]` : ""}`
  ).join("\n") || "No products available.";

  const chatHistory = (recentMessages || []).reverse().map((m: any) => ({
    role: m.direction === "incoming" ? "user" as const : "assistant" as const,
    content: m.image_url && m.direction === "incoming"
      ? [{ type: "text" as const, text: m.content || "Customer sent an image" }, { type: "image_url" as const, image_url: { url: m.image_url } }]
      : m.content || "",
  }));

  const hasImage = !!imageUrl;

  // Build product image reference for visual matching
  const productImageList = products?.filter((p: any) => p.image_url)
    .map((p: any) => `${p.name}${p.name_bn ? ` (${p.name_bn})` : ""} [${p.category || 'uncategorized'}] — ৳${p.price} — image: ${p.image_url}`)
    .join("\n") || "";

  const imageAnalysisPrompt = messageText
    ? `Customer said: "${messageText}" and sent this image.\n\nSTEP-BY-STEP ANALYSIS (do this internally before replying):\n1. LOOK at the image for 10 seconds. What EXACTLY is in it? Describe it to yourself.\n2. Item type: Is it a t-shirt (has sleeves, collar/round neck, body-length ends at waist/hip)? A hijab (head covering, flowing fabric, NO sleeves)? An abaya (full-length loose dress)? A sharee? A shoe? Something else entirely?\n3. COLOR: What exact color(s) do you see? Be specific — navy blue, forest green, maroon, cream, etc.\n4. PATTERN: Is it printed, plain, striped, embroidered?\n5. Now CHECK the catalog: Does ANY product match BOTH the item type AND the color? If a product matches the type but NOT the color, say that color is not available.\n6. If NOTHING in the catalog matches, say so honestly.\n\nDO NOT GUESS. If you're unsure, say you're unsure. Never call a t-shirt a hijab or vice versa.`
    : `Customer sent this image without text.\n\nSTEP-BY-STEP ANALYSIS (do this internally before replying):\n1. LOOK at the image carefully. What EXACTLY is this item?\n2. Identify: item type, color(s), pattern, fabric type, any visible brand/text.\n3. Is it a t-shirt? (sleeves, collar, ends at waist) A hijab? (head covering, no sleeves) An abaya? (full-length dress) Something else?\n4. Check your product catalog — does any product match this item's type AND color?\n5. If no match, say honestly it's not available.\n\nDO NOT GUESS. Be precise about what you see.`;

  const currentUserMessage: any = imageUrl
    ? { role: "user", content: [
        { type: "text", text: imageAnalysisPrompt },
        { type: "image_url", image_url: { url: imageUrl } }
      ]}
    : { role: "user", content: messageText || "" };

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

  const systemPrompt = `${settings.ai_personality || `You are "${settings.bot_name || "Fast Rep"}", the friendly sales assistant for "${settings.business_name || "our shop"}" on Facebook Messenger.`}
${settings.business_description ? `\nBusiness: ${settings.business_description}` : ""}
${settings.reply_tone ? `\nTone: ${settings.reply_tone}` : ""}
${settings.emoji_style ? `\nEmoji: ${settings.emoji_style}` : ""}

YOUR PERSONALITY:
- You are NOT a robot. You are a warm, witty, street-smart sales friend who genuinely cares about helping customers.
- Talk like a real person — use casual, friendly language. Like chatting with a buddy who happens to know everything about the products.
- Be enthusiastic but never pushy. Make customers feel special and valued.
- Show genuine interest in what they need. Ask follow-up questions to understand them better.
- Use humor naturally when appropriate. A little playfulness goes a long way.
- If they're browsing, gently guide them. If they're hesitant, reassure them. If they're excited, match their energy!

LANGUAGE RULES:
- Default language is Bangla (বাংলা). Reply in Bangla by default.
- If the customer writes in English, reply in English.
- Match the customer's language style and formality level.
- In Bangla, use natural conversational tone — like "ভাই/আপু" when appropriate, use "আপনি" for respect.
- Understand Bangla slang: "bhai", "ভাই", "vai", "apu", "আপু", "bro", "dada", "দাদা" etc.

PRODUCT CATALOG:
${productCatalog}

DEEP UNDERSTANDING RULES:
- Read ALL previous messages in the conversation carefully before replying. Understand the FULL context.
- If the customer sent 3, 5, or 10 messages — understand ALL of them together, don't just reply to the last one.
- "দাম কত", "price", "কত", "how much" = asking about pricing
- "আছে কি", "available", "stock আছে" = asking about availability
- "ভালো হবে?", "কেমন?", "quality?" = asking about quality — reassure them with confidence
- "দেখি", "think করি" = they're hesitant — gently encourage, mention benefits/offers
- Detect sentiment — if frustrated, be extra patient and empathetic. If excited, celebrate with them!
${settings.angry_customer_handling ? `\nANGRY/FRUSTRATED CUSTOMERS:\n${settings.angry_customer_handling}` : ""}
${settings.after_hours_message ? `\nFALLBACK:\n${settings.after_hours_message}` : ""}

SALES & ENGAGEMENT STRATEGY:
- Always think: "How can I help this customer AND make the sale?"
- When showing a product, highlight its BEST feature or unique selling point.
- Create gentle urgency when natural: "এটা কিন্তু খুব জনপ্রিয়" / "Stock limited আছে"
- Suggest related products: "এটার সাথে X ও দারুণ যায়!"
- If customer is comparing, help them decide — don't just list features, give a recommendation.
- After answering a question, always nudge toward next step: "অর্ডার করে দিই?" / "Shall I place the order?"
- If customer goes quiet after interest, follow up warmly: "কী ভাবছেন? কোনো প্রশ্ন থাকলে বলুন!"
- Use social proof: "এটা আমাদের বেস্ট সেলার" / "অনেকেই এটা নিচ্ছে"

${settings.image_instructions || `IMAGE HANDLING (ABSOLUTE TOP PRIORITY — ZERO MISTAKES ALLOWED):

STEP 1 — IDENTIFY THE ITEM (take your time, never rush):
- T-SHIRT indicators: has SLEEVES (short or long), has a NECKLINE (round/V/collar), BODY portion that covers torso, usually ends at waist or hip. Made of cotton/polyester. May have prints, logos, buttons.
- HIJAB indicators: a FABRIC PIECE meant to cover the head/hair. NO sleeves, NO body portion. Usually rectangular or triangular. Draped/wrapped around head and neck.
- ABAYA indicators: FULL-LENGTH loose dress with long sleeves, covers entire body from shoulders to ankles.
- SHAREE/SAREE indicators: long unstitched fabric, 5-6 yards, draped around body.
- POLO SHIRT: like t-shirt but has a COLLAR and 2-3 BUTTONS at the neck.

STEP 2 — IDENTIFY COLOR PRECISELY:
- Name the EXACT color: "navy blue" not just "blue", "forest green" not just "green", "maroon" not just "red".
- If multi-colored, list all colors you see.

STEP 3 — MATCH WITH CATALOG:
- Compare the item TYPE with catalog products. A t-shirt can only match t-shirt products. A hijab can only match hijab products.
- Compare the COLOR with what's available. If you have the product type but NOT that specific color, say: "এই রঙটা এখন নেই" / "This color isn't available right now"
- If the item matches a product, share name + price.
- If NO match at all: "এটা আমাদের কালেকশনে নেই, তবে আমাদের কাছে [relevant items] আছে! দেখবেন?"

STEP 4 — COMPETITOR/UNKNOWN IMAGES:
- NEVER describe competitor products in detail
- NEVER mention competitor brand names
- Redirect: "এটা আমাদের প্রোডাক্ট না, কিন্তু আমাদের দারুণ কালেকশন আছে! দেখবেন নাকি?"

PRODUCT IMAGES FOR REFERENCE:
${productImageList || "No product images available."}`}

${settings.order_instructions || "ORDER HANDLING:\n- When customer wants to order, make it super easy. Ask for: name, phone, address.\n- Confirm items and total with enthusiasm: \"দারুণ choice!\"\n- Always mention price (৳) and delivery info."}
${settings.delivery_info ? `\nDelivery: ${settings.delivery_info}` : ""}
${settings.payment_methods ? `\nPayment: ${settings.payment_methods}` : ""}

REPLY QUALITY RULES (THINK BEFORE EVERY REPLY):
- PAUSE and think: "What exactly is the customer asking? What do they want?"
- Read the ENTIRE conversation history. Don't repeat yourself. Don't contradict earlier messages.
- If customer sent an image, your #1 job is to CORRECTLY identify it. Wrong identification = trust broken forever.
- Match colors EXACTLY. If customer asks for green and you don't have green, say "সবুজ রঙটা এখন নেই" — don't send a different color.
- Answer product questions accurately with prices (৳).
- Keep replies concise but warm (2-3 sentences usually). Longer only for order summaries.
- Never write placeholders like [Image of ...] in chat.
- If customer asks for a picture, respond naturally (no technical excuses).
- Use 1-2 emojis naturally — not forced.
- Every reply should either: answer a question, build rapport, OR move toward a sale.
- When customer confirms order, give a clear summary: items, total, delivery info.
- NEVER sound robotic, generic, or copy-paste. Every reply should feel personal and thoughtful.
- If you're NOT SURE about something, say so honestly. Don't make up information.
${neverSaySection}
${settings.custom_instructions || ""}
${examplesSection}
${faqSection}

IMPORTANT: You are chatting on Facebook Messenger. Keep messages natural and conversational. No markdown formatting. No bullet points. Talk like a real human friend who's great at sales.`;

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
  return cleanedReply || settings.welcome_message || "ধন্যবাদ! আপনার মেসেজ পেয়েছি।";
}

async function detectAndCreateOrder(
  supabase: any, apiKey: string, conversationId: string,
  customerMessage: string | null, aiReply: string, userId: string | null
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

    const insertData: any = {
      conversation_id: conversationId,
      customer_name: orderData.customer_name || null,
      customer_phone: orderData.customer_phone || null,
      customer_address: orderData.customer_address || null,
      items: orderData.items || [],
      total: orderData.total || 0,
      status: "pending",
    };
    if (userId) insertData.user_id = userId;

    await supabase.from("orders").insert(insertData);
    console.log("Order created for conversation:", conversationId);
  } catch (e) {
    console.error("Order detection error:", e);
  }
}
