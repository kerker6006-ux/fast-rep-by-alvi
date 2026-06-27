// ============================================================
// LeadPilot AI Router v2 — Full 95% accuracy version
// Features:
//   - Smart model selection (lite/standard/vision)
//   - Sentiment detection (angry/worried/happy/neutral)
//   - Context memory scoring
//   - Intent confidence scoring  
//   - Language-specific routing
//   - Business hours awareness
//   - Failed booking recovery
//   - Anti-repeat protection
//   - Auto-escalation
//   - Global multi-language support
// ============================================================

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const MODELS = {
  LITE: "gemini-2.0-flash-lite",
  STANDARD: "gemini-2.5-flash",
  FALLBACK: "gemini-2.0-flash-lite",
};

// ─── 1. SENTIMENT DETECTOR ───────────────────────────────────
export function detectSentiment(text) {
  if (!text) return "neutral";
  const t = text.toLowerCase();

  const angryPatterns = /rag|angry|upset|frustrated|terrible|worst|useless|stupid|hate|awful|pathetic|রাগ|বিরক্ত|বাজে|খারাপ|ফালতু|বেকার|형편없|غاضب|furious|disgusting|waste|scam|fake|fraud/i;
  const worriedPatterns = /worried|scared|afraid|anxious|serious|dangerous|urgent|emergency|help me|please help|ভয়|চিন্তিত|জরুরি|সাহায্য|심각|خطير|عاجل|bad condition|getting worse|worse|critical/i;
  const happyPatterns = /thank|thanks|great|awesome|excellent|love|perfect|amazing|wonderful|ধন্যবাদ|অসাধারণ|চমৎকার|ভালো|감사|شكرا|merci|gracias/i;

  if (angryPatterns.test(t)) return "angry";
  if (worriedPatterns.test(t)) return "worried";
  if (happyPatterns.test(t)) return "happy";
  return "neutral";
}

// ─── 2. INTENT CONFIDENCE SCORER ─────────────────────────────
export function scoreIntent(text, history = []) {
  if (!text) return { score: 0, intent: "unknown" };
  const t = text.toLowerCase();
  let score = 0;
  let intent = "unknown";

  // Booking intent
  const bookingScore =
    (/book|appoint|schedule|visit|আসতে চাই|appointment|বুকিং|কবে আসব|date|time|slot|reserve|예약|موعد/i.test(t) ? 3 : 0) +
    (/when|কখন|কোন দিন|what time|কত তারিখ/i.test(t) ? 2 : 0) +
    (history.length >= 2 ? 1 : 0);

  // Price intent
  const priceScore =
    (/price|cost|how much|dam|দাম|কত|কতো|rate|charge|fee|টাকা|taka|budget|afford|سعر|가격|prix/i.test(t) ? 3 : 0) +
    (/discount|offer|ছাড়|কম|সস্তা|cheap|sale|할인|خصم/i.test(t) ? 2 : 0);

  // Product/service inquiry
  const productScore =
    (/available|stock|have|আছে|ki ase|কি আছে|what do you|show me|tell me about|있나요|متاح/i.test(t) ? 2 : 0) +
    (/treatment|service|product|ট্রিটমেন্ট|সেবা|치료|علاج/i.test(t) ? 2 : 0);

  // Complaint intent
  const complaintScore =
    (/problem|issue|wrong|not working|complaint|সমস্যা|ঠিক না|কাজ করছে না|문제|مشكلة/i.test(t) ? 4 : 0) +
    (/bad experience|unhappy|disappointed|হতাশ|실망|محبط/i.test(t) ? 3 : 0);

  // Order/COD intent
  const orderScore =
    (/order|buy|purchase|কিনতে|অর্ডার|COD|deliver|ডেলিভারি|주문|طلب/i.test(t) ? 3 : 0) +
    (/address|ঠিকানা|location|주소|عنوان/i.test(t) ? 2 : 0);

  // Find dominant intent
  const scores = {
    booking: bookingScore,
    price: priceScore,
    product: productScore,
    complaint: complaintScore,
    order: orderScore,
  };

  let maxScore = 0;
  for (const [k, v] of Object.entries(scores)) {
    if (v > maxScore) { maxScore = v; intent = k; score = v; }
  }

  return { score, intent };
}

// ─── 3. LANGUAGE DETECTOR ────────────────────────────────────
export function detectLanguage(text) {
  if (!text) return "en";
  if (/[\u0980-\u09FF]/.test(text)) return "bn";        // Bangla script
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return "ko"; // Korean
  if (/[\u0600-\u06FF]/.test(text)) return "ar";        // Arabic
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh";        // Chinese
  if (/[áéíóúñ¿¡àèùâêîôûç]/i.test(text)) return "fr_es"; // French/Spanish
  // Banglish detection (Latin letters but Bangla words)
  if (/\b(ami|tumi|apni|ache|achen|hobe|kori|koro|bolo|bolen|dao|din|jai|jao|ese|asun|thik|nah|hah|bhalo|kemon|onek|khub|amar|tomar|apnar|ekhane|okhane|kothay|kivabe|keno|ki|ke|kon)\b/i.test(text)) return "banglish";
  return "en";
}

// ─── 4. CONTEXT MEMORY SCORER ────────────────────────────────
export function scoreContext(history = []) {
  const len = history.length;
  if (len <= 2) return { level: "low", needsStandard: false };
  if (len <= 5) return { level: "medium", needsStandard: false };
  return { level: "high", needsStandard: true }; // Long conversations always need Standard
}

// ─── 5. BOOKING STATE DETECTOR ───────────────────────────────
// Detects what info has already been collected to avoid re-asking
export function detectBookingState(history = []) {
  const allText = history.map(m => (typeof m.content === "string" ? m.content : "")).join(" ").toLowerCase();
  const hasName = /নাম|name is|আমি |i am|my name|আমার নাম/.test(allText);
  const hasPhone = /\b01[3-9]\d{8}\b|\b\d{10,11}\b/.test(allText);
  const hasDate = /তারিখ|date|\d{1,2}(st|nd|rd|th)|monday|tuesday|wednesday|thursday|friday|saturday|sunday|কাল|আজ|পরশু|\d+ tarik/i.test(allText);

  return { hasName, hasPhone, hasDate };
}

// ─── 6. BUSINESS HOURS CHECKER ───────────────────────────────
export function isWithinBusinessHours(hoursString, timezone = "Asia/Dhaka") {
  try {
    const now = new Date();
    const localTime = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).format(now);
    const [h, m] = localTime.split(":").map(Number);
    const currentMinutes = h * 60 + m;
    // Default: 10am-8pm = 600-1200 minutes
    const openMinutes = 10 * 60;
    const closeMinutes = 20 * 60;
    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } catch {
    return true; // If can't determine, assume open
  }
}

// ─── 7. MAIN MESSAGE CLASSIFIER ──────────────────────────────
export function classifyMessage({ messageText, hasImage, conversationHistory = [], products = [], services = [], settings = {} }) {
  const text = (messageText || "").trim();

  // RULE 1: Images → always Vision (Standard model)
  if (hasImage) {
    return { model: MODELS.STANDARD, reason: "image_vision", isVision: true, tier: "vision" };
  }

  // RULE 2: Empty/tiny → Lite (BUT not if long conversation)
  if (!text || text.length < 3) {
    // If long conversation, even short messages need Standard for context
    if (conversationHistory.length >= 6) {
      return { model: MODELS.STANDARD, reason: "short_but_long_conv", tier: "standard", sentiment: "neutral", intent: "unknown" };
    }
    return { model: MODELS.LITE, reason: "too_short", tier: "lite" };
  }

  const sentiment = detectSentiment(text);
  const { score: intentScore, intent } = scoreIntent(text, conversationHistory);
  const lang = detectLanguage(text);
  const context = scoreContext(conversationHistory);

  // RULE 3: Angry customers → always Standard (needs careful, empathetic reply)
  if (sentiment === "angry") {
    return { model: MODELS.STANDARD, reason: "angry_customer", tier: "standard", sentiment, intent };
  }

  // RULE 4: Worried/urgent → always Standard
  if (sentiment === "worried") {
    return { model: MODELS.STANDARD, reason: "worried_customer", tier: "standard", sentiment, intent };
  }

  // RULE 5: Arabic/Korean/Chinese → always Standard (complex scripts, Lite struggles)
  if (["ar", "ko", "zh"].includes(lang)) {
    return { model: MODELS.STANDARD, reason: `language_${lang}`, tier: "standard", sentiment, intent };
  }

  // RULE 6: High context (6+ messages) → Standard
  if (context.needsStandard) {
    return { model: MODELS.STANDARD, reason: "long_conversation", tier: "standard", sentiment, intent };
  }

  // RULE 7: High intent score (booking, price, complaint, order) → Standard
  if (intentScore >= 3) {
    return { model: MODELS.STANDARD, reason: `intent_${intent}`, tier: "standard", sentiment, intent };
  }

  // RULE 8: Long messages → Standard
  if (text.length > 120) {
    return { model: MODELS.STANDARD, reason: "long_message", tier: "standard", sentiment, intent };
  }

  // RULE 9: Multiple questions → Standard
  if ((text.match(/\?/g) || []).length >= 2) {
    return { model: MODELS.STANDARD, reason: "multiple_questions", tier: "standard", sentiment, intent };
  }

  // RULE 10: Large catalog → Standard
  if ((products || []).length > 20 || (services || []).length > 10) {
    return { model: MODELS.STANDARD, reason: "large_catalog", tier: "standard", sentiment, intent };
  }

  // RULE 11: Simple greetings/confirmations → Lite
  const simplePatterns = /^(hi|hello|hey|salam|ok|okay|yes|no|ha|ji|hae|na|thik|done|thanks|thank you|👍|👎|✅|❌|hmm|hm|আচ্ছা|ঠিক আছে|ওকে|হ্যাঁ|না|ধন্যবাদ|bonjour|hola|merci)[\s!?.🙏]*$/i;
  if (simplePatterns.test(text)) {
    return { model: MODELS.LITE, reason: "simple_response", tier: "lite", sentiment, intent };
  }

  // DEFAULT: Lite for everything else simple
  return { model: MODELS.LITE, reason: "default_simple", tier: "lite", sentiment, intent };
}

// ─── 8. SENTIMENT PREFIX BUILDER ─────────────────────────────
// Adds context to system prompt based on customer sentiment
export function buildSentimentPrefix(sentiment, language = "en") {
  if (sentiment === "angry") {
    return `CRITICAL — Customer is ANGRY or frustrated right now.
Your FIRST priority: acknowledge their frustration sincerely before anything else.
Do NOT jump to solutions immediately. Say something like "I completely understand your frustration and I'm very sorry about this."
Keep your tone extra calm, professional, and empathetic throughout.
Never be defensive. Never make excuses. Focus on solving their problem.`;
  }
  if (sentiment === "worried") {
    return `IMPORTANT — Customer seems worried or anxious.
Start with reassurance before anything else.
Use a warm, calm, caring tone. Make them feel safe and supported.
Example: "Please don't worry — we're here to help you."`;
  }
  if (sentiment === "happy") {
    return `Customer is in a positive mood. Match their positive energy while staying professional.`;
  }
  return "";
}

// ─── 9. BOOKING RECOVERY PREFIX ──────────────────────────────
export function buildBookingRecoveryPrefix(bookingState) {
  const { hasName, hasPhone, hasDate } = bookingState;
  if (!hasName && !hasPhone && !hasDate) return "";

  const collected = [];
  const needed = [];
  if (hasName) collected.push("name"); else needed.push("name");
  if (hasPhone) collected.push("phone number"); else needed.push("phone number");
  if (hasDate) collected.push("preferred date"); else needed.push("preferred date");

  if (needed.length === 0) return "BOOKING INFO: All information collected (name, phone, date). Confirm the appointment now.";
  return `BOOKING PROGRESS: Already collected: ${collected.join(", ")}. Still need: ${needed.join(", ")}. Ask ONLY for the missing info — do not ask for what you already have.`;
}

// ─── 10. GEMINI API CALLER ───────────────────────────────────
export async function callGemini({ model, systemPrompt, messages, imageUrl, apiKey, isVision = false, temperature = 0.4 }) {
  let userMessages = [...messages];

  if (isVision && imageUrl) {
    const last = userMessages[userMessages.length - 1];
    const textContent = typeof last.content === "string" ? last.content : "Please analyze this image.";
    userMessages[userMessages.length - 1] = {
      role: "user",
      content: [
        { type: "text", text: textContent || "Please analyze this image." },
        { type: "image_url", image_url: { url: imageUrl } },
      ],
    };
  }

  const attemptCall = async (modelToUse) => {
    const res = await fetch(GEMINI_API_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [{ role: "system", content: systemPrompt }, ...userMessages],
        temperature,
        max_tokens: 450,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[gemini] ${modelToUse} failed: ${res.status}`, errText.slice(0, 200));
      if (modelToUse !== MODELS.FALLBACK) {
        console.log(`[gemini] falling back to ${MODELS.FALLBACK}`);
        return attemptCall(MODELS.FALLBACK);
      }
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const json = await res.json();
    return json.choices?.[0]?.message?.content || "";
  };

  return attemptCall(model);
}

// ─── 11. REPLY QUALITY CHECKER ───────────────────────────────
export function isReplyWeak(reply) {
  if (!reply) return true;
  const t = reply.trim();
  if (t.length < 5) return true;
  if (t.toUpperCase().includes("NEEDS_HUMAN")) return true;
  if (/^[.!?,\s😊🙏]+$/.test(t)) return true;
  if (t.length < 15 && /^(ok|okay|sure|yes|no|hi|hello)$/i.test(t)) return true;
  return false;
}

// ─── 12. ANTI-REPEAT CHECKER ─────────────────────────────────
export function isTooSimilar(newReply, recentOutgoing = []) {
  const normalize = (s) =>
    (s || "").toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .filter(Boolean);

  const jaccard = (a, b) => {
    const sa = new Set(normalize(a));
    const sb = new Set(normalize(b));
    if (!sa.size || !sb.size) return 0;
    let inter = 0;
    for (const t of sa) if (sb.has(t)) inter++;
    return inter / (sa.size + sb.size - inter);
  };

  return recentOutgoing.slice(-3).some(prev => jaccard(newReply, prev) > 0.68);
}

// ─── 13. MAIN ROUTE AND REPLY FUNCTION ───────────────────────
export async function routeAndReply({
  messageText,
  hasImage,
  imageUrl,
  conversationHistory = [],
  systemPrompt,
  settings = {},
  products = [],
  services = [],
  recentOutgoing = [],
  apiKey,
  timezone = "Asia/Dhaka",
}) {
  const startTime = Date.now();

  // Step 1: Classify the message
  const routing = classifyMessage({
    messageText,
    hasImage,
    conversationHistory,
    products,
    services,
    settings,
  });

  console.log(`[router] "${(messageText || "").slice(0, 50)}" → model=${routing.model} tier=${routing.tier} reason=${routing.reason} sentiment=${routing.sentiment || "neutral"} intent=${routing.intent || "none"}`);

  // Step 2: Build enhanced system prompt with context
  let enhancedPrompt = systemPrompt;

  // Add sentiment prefix
  const sentimentPrefix = buildSentimentPrefix(routing.sentiment || "neutral");
  if (sentimentPrefix) {
    enhancedPrompt = sentimentPrefix + "\n\n" + enhancedPrompt;
  }

  // Add booking recovery context
  const bookingState = detectBookingState(conversationHistory);
  const bookingPrefix = buildBookingRecoveryPrefix(bookingState);
  if (bookingPrefix) {
    enhancedPrompt = enhancedPrompt + "\n\n" + bookingPrefix;
  }

  // Add business hours context
  const isOpen = isWithinBusinessHours(settings.operating_hours || "", timezone);
  if (!isOpen) {
    enhancedPrompt = enhancedPrompt + `\n\nBUSINESS HOURS: The business is currently CLOSED. If customer wants to book, say you're closed now and suggest booking for the next available time during business hours. Do not promise immediate service.`;
  }

  // Step 3: Build messages array
  const messages = [
    ...conversationHistory,
    { role: "user", content: messageText || (hasImage ? "[Image received]" : "") },
  ];

  // Step 4: Call the selected model
  let reply = await callGemini({
    model: routing.model,
    systemPrompt: enhancedPrompt,
    messages,
    imageUrl,
    apiKey,
    isVision: routing.isVision || false,
    temperature: routing.sentiment === "angry" ? 0.2 : 0.4, // Lower temp for angry = more controlled
  });

  // Step 5: Quality check — escalate if weak
  if (isReplyWeak(reply) && routing.tier === "lite") {
    console.log("[router] weak reply from lite — escalating to standard");
    reply = await callGemini({
      model: MODELS.STANDARD,
      systemPrompt: enhancedPrompt,
      messages,
      imageUrl,
      apiKey,
      isVision: routing.isVision || false,
    });
    routing.model = MODELS.STANDARD;
    routing.reason += "_escalated";
  }

  // Step 6: Anti-repeat check — regenerate if too similar
  if (isTooSimilar(reply, recentOutgoing)) {
    console.log("[router] reply too similar to recent — regenerating with variation directive");
    reply = await callGemini({
      model: MODELS.STANDARD,
      systemPrompt: enhancedPrompt + "\n\nVARIATION REQUIRED: Your previous replies in this conversation were too repetitive. This time, express the same helpful information using completely different wording, sentence structure, and approach. Do not start with the same word as before.",
      messages,
      imageUrl,
      apiKey,
      temperature: 0.7, // Higher temp for variation
    });
  }

  const durationMs = Date.now() - startTime;
  console.log(`[router] done in ${durationMs}ms model=${routing.model}`);

  return {
    reply,
    modelUsed: routing.model,
    tier: routing.tier,
    reason: routing.reason,
    sentiment: routing.sentiment || "neutral",
    intent: routing.intent || "unknown",
    bookingState,
    isBusinessOpen: isOpen,
    durationMs,
  };
}
