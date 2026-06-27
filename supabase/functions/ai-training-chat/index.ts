import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Native Gemini API call (works with AQ. and AIzaSy. keys) ──
async function callGemini(model: string, systemPrompt: string, messages: any[], apiKey: string, temperature = 0.4, maxTokens = 500): Promise<string> {
  const contents = messages.map((m: any) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[gemini] error:", res.status, err.slice(0, 300));
    throw new Error(`Gemini API error: ${res.status} - ${err.slice(0, 100)}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ── Gemini with tool use (for generate_settings) ──
async function callGeminiWithTools(model: string, systemPrompt: string, messages: any[], apiKey: string, toolName: string, toolSchema: any): Promise<any> {
  const contents = messages.map((m: any) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        tools: [{ functionDeclarations: [{ name: toolName, description: "Save settings", parameters: toolSchema }] }],
        tool_config: { function_calling_config: { mode: "ANY", allowed_function_names: [toolName] } },
        generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[gemini-tools] error:", res.status, err.slice(0, 300));
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  const call = data.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall);
  return call?.functionCall?.args || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    const { action, messages, settings, category, language, page_id } = body;

    const LANG_NAMES: Record<string, string> = { en: "English", bn: "Bangla (বাংলা)", es: "Spanish (Español)", ko: "Korean (한국어)" };
    const cat = (category && ["ecommerce", "service", "content_creator"].includes(category)) ? category : "ecommerce";
    const chatLang = language && LANG_NAMES[language] ? language : "";
    const chatLangName = chatLang ? LANG_NAMES[chatLang] : "";

    // Get API key - hardcoded fallback ensures it always works
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "AQ.Ab8RN6JPAkC-US2oy7vl28rRCTz9aes6EjHbOPN0hR-vsGAFSg";

    // ── ACTION: test_bot ──────────────────────────────────────────
    if (action === "test_bot") {
      const biz = settings?.business_name || "our business";
      const aiPersonality = settings?.ai_personality || `You are the AI assistant for "${biz}".`;
      const replyLang = settings?.reply_language || "mix";
      const custom = settings?.custom_instructions || "";
      const tone = settings?.reply_tone || "friendly, helpful, brief";

      let faqs = [], neverSay = [];
      try { faqs = JSON.parse(settings?.faq_list || "[]"); } catch {}
      try { neverSay = JSON.parse(settings?.never_say_list || "[]"); } catch {}

      const langRule = replyLang === "bn" ? "ALWAYS reply in Bangla (বাংলা). No exceptions."
        : replyLang === "ko" ? "ALWAYS reply in Korean (한국어)."
        : replyLang === "en" ? "ALWAYS reply in English."
        : "Detect customer language and reply in the same language.";

      const systemPrompt = [
        aiPersonality,
        settings?.business_description && `About: ${settings.business_description}`,
        settings?.business_address && `Address: ${settings.business_address}`,
        settings?.operating_hours && `Hours: ${settings.operating_hours}`,
        settings?.payment_methods && `Payment: ${settings.payment_methods}`,
        faqs.length > 0 && `FAQ:\n${faqs.map((f: any) => `Q: ${f.q}\nA: ${f.a}`).join("\n")}`,
        neverSay.length > 0 && `NEVER say: ${neverSay.join(", ")}`,
        custom && `INSTRUCTIONS: ${custom}`,
        `TONE: ${tone}. Max 3-4 sentences.`,
        `LANGUAGE: ${langRule}`,
        `[TEST MODE — Reply exactly as you would to a real customer]`,
      ].filter(Boolean).join("\n\n");

      const reply = await callGemini("gemini-2.5-flash", systemPrompt, messages || [], GEMINI_API_KEY);
      return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: generate_settings ─────────────────────────────────
    if (action === "generate_settings") {
      const systemPrompt = `You are an expert AI bot configurator. Based on the training conversation, generate the most effective bot settings.
Create settings that sound EXACTLY like this business owner - their tone, selling style, exact phrases. Not generic. Not robotic. THEIRS.
ai_personality must be 8-12 lines of direct instructions. Write as "You are..." and "When a customer says X, you say Y..."
faq_list must be a JSON array string of {q, a} objects with 8-12 FAQs in the customer's actual language.
never_say_list must be a JSON array string of specific phrases to avoid.`;

      const toolSchema = {
        type: "object",
        properties: {
          bot_name: { type: "string" },
          business_name: { type: "string" },
          business_description: { type: "string" },
          ai_personality: { type: "string" },
          custom_instructions: { type: "string" },
          reply_tone: { type: "string" },
          welcome_message: { type: "string" },
          delivery_info: { type: "string" },
          payment_methods: { type: "string" },
          return_policy: { type: "string" },
          operating_hours: { type: "string" },
          business_address: { type: "string" },
          order_instructions: { type: "string" },
          never_say_list: { type: "string" },
          faq_list: { type: "string" },
        },
        required: ["ai_personality", "business_name"],
      };

      const allMessages = [
        ...(messages || []),
        { role: "user", content: "Based on everything we discussed, generate the complete bot settings." }
      ];

      const args = await callGeminiWithTools("gemini-2.5-flash", systemPrompt, allMessages, GEMINI_API_KEY, "save_settings", toolSchema);

      if (!args) throw new Error("No settings generated");
      return new Response(JSON.stringify({ settings: args }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── ACTION: chat (wizard conversation) ───────────────────────
    const businessName = settings?.business_name || "";
    const knownFields = settings ? Object.entries(settings).filter(([k, v]) => v && String(v).trim()).map(([k]) => k) : [];
    const knownSummary = knownFields.length > 0 ? `Already set: ${knownFields.join(", ")}` : "Nothing configured yet";

    const MISSING_BY_CAT: Record<string, string[]> = {
      ecommerce: ["business_name", "business_description", "delivery_info", "payment_methods", "return_policy", "ai_personality", "faq_list"],
      service: ["business_name", "business_description", "operating_hours", "business_address", "payment_methods", "ai_personality", "faq_list"],
      content_creator: ["business_name", "business_description", "payment_methods", "ai_personality", "faq_list"],
    };
    const missing = (MISSING_BY_CAT[cat] || []).filter(f => !settings?.[f] || !String(settings[f]).trim());
    const missingList = missing.length > 0 ? missing.join(", ") : "None — ready to apply!";

    const WIZARD_BY_CAT: Record<string, string> = {
      ecommerce: `You are "TrainBot" — a friendly AI business coach helping a Facebook shop owner set up their AI sales bot in under 5 minutes.
YOUR PERSONALITY: Warm, smart, fast. Like a friend who knows business — casual language, genuine reactions ("Nice!", "Got it!", "Smart move!").
YOUR MISSION: Extract what the live bot needs to sell: products, delivery, payment, how to handle objections, selling style.
CONVERSATION: Ask 1 question at a time. React naturally to answers. Confirm each answer back briefly. If vague, ask one sharp follow-up.`,

      service: `You are "TrainBot" — a friendly AI coach helping a service business set up their AI receptionist in under 5 minutes.
YOUR PERSONALITY: Warm, professional, fast. Like a smart receptionist trainer.
YOUR MISSION: Extract: services offered, pricing approach, hours, location, booking flow, common questions.
CONVERSATION: Ask 1 question at a time. Start with "Hi! What kind of service business is this?"`,

      content_creator: `You are "TrainBot" — helping an online creator set up their AI enrollment bot.
YOUR PERSONALITY: Enthusiastic, smart, fast. Like a fellow creator.
YOUR MISSION: Extract: courses/products, pricing, enrollment process, common objections, creator's voice.
CONVERSATION: Start with "Hey! What's the main course or product you're selling right now?"`,
    };

    const langRule = chatLangName
      ? `\nLANGUAGE LOCK: ALWAYS reply ONLY in ${chatLangName}. Do NOT switch languages.`
      : `\nMirror the user's language naturally.`;

    const systemPrompt = `${WIZARD_BY_CAT[cat]}

ALREADY CONFIGURED: ${knownSummary}
STILL NEED: ${missingList}
${businessName ? `Business name: "${businessName}"` : ""}

RULES:
- Ask 1 question at a time MAX
- Keep replies to 2-3 lines
- Confirm each answer briefly before moving on
- If they say "I don't know", suggest a common option
- When all topics covered, say "Your bot is all set! Click Apply Settings above." then output [[SETUP_COMPLETE]] on its own line
${langRule}`;

    const reply = await callGemini("gemini-2.5-flash", systemPrompt, messages || [], GEMINI_API_KEY);

    // Log usage
    try {
      await supabase.from("ai_usage").insert({
        user_id: user.id,
        model: "gemini-2.5-flash",
        estimated_cost: 0.001,
        tokens_used: 200,
      });
    } catch {}

    return new Response(JSON.stringify({ reply, setupComplete: reply.includes("[[SETUP_COMPLETE]]") }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("[ai-training-chat] error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
