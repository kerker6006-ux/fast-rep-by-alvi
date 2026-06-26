import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRAINING_CALL_COST = 0.0015;

async function logTrainingUsage(req: Request, model: string) {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return;
    await supabase.from("ai_usage").insert({
      user_id: userId,
      call_type: "training",
      model,
      estimated_cost: TRAINING_CALL_COST,
    });
  } catch (e) {
    console.error("Failed to log training usage:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, action, settings, category, language, analysis_context } = await req.json();
    const cat: string = (category && ["ecommerce", "service", "content_creator"].includes(category)) ? category : "ecommerce";
    const LANG_NAMES: Record<string, string> = { en: "English", bn: "Bangla (বাংলা)", es: "Spanish (Español)", ko: "Korean (한국어)" };
    const chatLang: string = (language && LANG_NAMES[language]) ? language : (settings?.training_chat_language && LANG_NAMES[settings.training_chat_language] ? settings.training_chat_language : "");
    const chatLangName = chatLang ? LANG_NAMES[chatLang] : "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? Deno.env.get("GEMINI_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Action: test bot with real settings (used by Test Bot tab)
    if (action === "test_bot") {
      const category = cat;
      const biz = settings?.business_name || "our business";
      const aiPersonality = settings?.ai_personality || `You are the AI assistant for "${biz}".`;
      const replyLang = settings?.reply_language || "mix";
      const custom = settings?.custom_instructions || "";
      const tone = settings?.reply_tone || "friendly, helpful, brief";

      let faqs: any[] = [];
      let neverSay: any[] = [];
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
        custom && `SPECIAL INSTRUCTIONS: ${custom}`,
        `TONE: ${tone}. Max 3-4 sentences per reply.`,
        `LANGUAGE: ${langRule}`,
        `[TEST MODE: Reply exactly as you would to a real customer.]`,
      ].filter(Boolean).join("\n\n");

      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...(messages || []),
          ],
          temperature: 0.4,
          max_tokens: 400,
        }),
      });

      if (!response.ok) throw new Error(`AI error: ${response.status}`);
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || "No reply";
      await logTrainingUsage(req, "google/gemini-2.5-flash");
      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: generate settings from training conversation
    if (action === "generate_settings") {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are an expert AI bot configurator. Based on the training conversation, generate the most effective bot settings possible.

Your goal: create a bot that sounds EXACTLY like this business owner — their tone, their selling style, their exact phrases. Not generic. Not robotic. THEIRS.

Return a JSON object. Only include keys that were actually discussed. Keys:
- bot_name: string (e.g. "Scarlet Derma Bot", "ShopBot for [Brand]")
- business_name: string
- business_description: string (3-5 sentences: what they do, who they serve, what makes them special, their selling edge)
- ai_personality: string (THIS IS THE MOST IMPORTANT FIELD — write 8-12 lines of direct instructions to the bot. Include: their exact tone, how they handle price questions, how they push toward conversion, common phrases to use, how they handle hesitant customers. Write as "You are..." and "When a customer says X, you say Y...")
- custom_instructions: string (specific operational rules: what to do when, what to never do)
- reply_tone: string (1 line describing voice: e.g. "Warm, direct, expert. Like a trusted friend who knows skin care.")
- welcome_message: string (in the business's actual language/tone — not generic)
- out_of_stock_message: string (only for ecommerce)
- delivery_info: string
- payment_methods: string
- return_policy: string
- operating_hours: string (only for service)
- business_address: string (only for service)
- pricing_policy: string (only for service)
- cancellation_policy: string (only for service)
- order_instructions: string
- image_instructions: string
- never_say_list: JSON array of strings (things the bot should NEVER say — be specific)
- faq_list: JSON array of {q, a} objects (8-12 FAQs in the customer's actual language)
- reply_examples: JSON array of {customer, reply, category} objects (5-8 real example exchanges showing the bot's exact style)

CRITICAL: 
- ai_personality must be SPECIFIC to THIS business — not generic chatbot instructions
- faq_list questions should be in the CUSTOMER's language (if they speak Bangla, write Bangla questions)
- reply_examples should show the bot handling real situations this business faces
- never_say_list should be specific (not just "don't be rude" — actual phrases to avoid)
- never_say_list, faq_list, reply_examples must be valid JSON strings`,
            },
            ...messages,
            {
              role: "user",
              content: "Based on everything we discussed, generate the complete bot settings as a JSON object. Make the ai_personality and faq_list especially detailed and specific to this business.",
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "save_settings",
              description: "Save the generated bot settings",
              parameters: {
                type: "object",
                properties: {
                  bot_name: { type: "string" },
                  business_name: { type: "string" },
                  business_description: { type: "string" },
                  ai_personality: { type: "string" },
                  custom_instructions: { type: "string" },
                  reply_tone: { type: "string" },
                  welcome_message: { type: "string" },
                  out_of_stock_message: { type: "string" },
                  delivery_info: { type: "string" },
                  payment_methods: { type: "string" },
                  return_policy: { type: "string" },
                  operating_hours: { type: "string" },
                  business_address: { type: "string" },
                  pricing_policy: { type: "string" },
                  cancellation_policy: { type: "string" },
                  order_instructions: { type: "string" },
                  image_instructions: { type: "string" },
                  never_say_list: { type: "string" },
                  faq_list: { type: "string" },
                  reply_examples: { type: "string" },
                },
                required: ["ai_personality", "business_name"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "save_settings" } },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI error:", response.status, errText);
        return new Response(JSON.stringify({ error: "AI error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        return new Response(JSON.stringify({ error: "No settings generated" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const generatedSettings = JSON.parse(toolCall.function.arguments);
      await logTrainingUsage(req, "google/gemini-2.5-flash");
      return new Response(JSON.stringify({ settings: generatedSettings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: generate FAQ suggestions from real customer messages
    if (action === "faq_suggestions") {
      const customerMsgs = messages?.[0]?.content || "";
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `You analyze real customer messages from a Facebook page and identify the most frequently asked questions. Generate FAQ entries with appropriate answers.

Business context:
${settings?.business_name ? `Business: ${settings.business_name}` : ""}
${settings?.delivery_info ? `Delivery: ${settings.delivery_info}` : ""}
${settings?.payment_methods ? `Payment: ${settings.payment_methods}` : ""}

Rules:
- Identify 8-10 most common question PATTERNS from the messages
- Write questions in the language customers actually use (Bangla or English)
- Write helpful, concise answers based on the business context
- Include both Bangla and English versions if customers use both
- Focus on REAL patterns you see, not generic questions
- Return ONLY a JSON array: [{"q":"question","a":"answer"}]`
            },
            { role: "user", content: customerMsgs }
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) throw new Error(`AI error: ${response.status}`);
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "[]";
      let faqs;
      try {
        const parsed = JSON.parse(content);
        faqs = Array.isArray(parsed) ? parsed : parsed.faqs || parsed.faq || [];
      } catch {
        faqs = [];
      }

      await logTrainingUsage(req, "google/gemini-2.5-flash-lite");
      return new Response(JSON.stringify({ faqs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Build known vs missing field lists per niche so the AI never re-asks
    const PRIORITY_BY_CAT: Record<string, string[]> = {
      ecommerce: ["business_name", "business_description", "reply_tone", "delivery_info", "payment_methods", "return_policy", "welcome_message", "out_of_stock_message", "faq_list", "never_say_list", "order_instructions"],
      service: ["business_name", "business_description", "reply_tone", "operating_hours", "business_address", "pricing_policy", "cancellation_policy", "emergency_policy", "welcome_message", "faq_list", "never_say_list"],
      content_creator: ["business_name", "business_description", "reply_tone", "course_lineup", "enrollment_info", "refund_policy", "support_channel", "welcome_message", "faq_list", "never_say_list"],
    };
    const priority = PRIORITY_BY_CAT[cat] || PRIORITY_BY_CAT.ecommerce;
    const isFilled = (k: string, v: unknown): boolean => {
      if (v === null || v === undefined) return false;
      const s = String(v).trim();
      if (!s) return false;
      if (k === "faq_list" || k === "never_say_list" || k === "reply_examples") {
        try { const arr = JSON.parse(s); return Array.isArray(arr) && arr.length > 0; } catch { return false; }
      }
      return true;
    };
    const known: string[] = [];
    const missing: string[] = [];
    for (const k of priority) {
      if (isFilled(k, settings?.[k])) known.push(k); else missing.push(k);
    }
    const businessName = (settings?.business_name && String(settings.business_name).trim()) || "";

    const knownSummary = known.length
      ? known.map((k) => `- ${k}: ${String(settings[k]).slice(0, 200)}`).join("\n")
      : "(nothing configured yet)";
    const missingList = missing.length ? missing.join(", ") : "(everything is filled — confirm and offer to save)";

    const wizardByCategory: Record<string, string> = {
      ecommerce: `You are "TrainBot" — a friendly AI business coach helping a Facebook shop owner set up their AI sales bot in under 5 minutes.

YOUR PERSONALITY: Warm, smart, fast. Like a friend who knows about business — not a boring form or a formal consultant. Use casual language. React naturally to answers ("Nice!", "Got it!", "Smart move!"). Be encouraging.

YOUR MISSION: Extract everything the live bot needs to sell confidently. The live bot's job is to pitch products, handle objections, collect orders (name/phone/address), and close sales. You need to understand:
1. What they sell + who buys it
2. Delivery, payment, return rules
3. How they handle common objections ("too expensive", "not sure", "let me think")
4. Their selling style (aggressive? soft? consultative?)
5. What NOT to say

CONVERSATION STYLE:
- Start with a warm greeting + 1 specific question (not "tell me about your business" — ask something specific like "What's your most popular product?")
- After each answer: acknowledge briefly + dig deeper OR move to next topic
- Mix questions naturally: don't announce "now I'll ask about delivery" — weave it in
- If they give a vague answer ("we sell stuff"), ask a sharp follow-up ("What stuff specifically? Any bestsellers?")
- If they give a great answer, extract the exact language and confirm it ("So if a customer asks about price, the bot should say something like '...right?")`,

      service: `You are "TrainBot" — a friendly AI business coach helping a service business owner (clinic, salon, repair shop, consultant, etc.) set up their AI booking bot in under 5 minutes.

YOUR PERSONALITY: Warm, professional, fast. Like a smart receptionist trainer — not a boring form.

YOUR MISSION: Extract everything the live bot needs to book appointments confidently. The live bot's job is to qualify the patient/client, understand their need, collect name/phone/preferred date, and confirm bookings. You need to understand:
1. What services they offer + who their typical client is
2. Location, hours, how to book
3. How they handle price questions (do they quote on the phone? after consultation?)
4. What NOT to promise
5. Emergency/urgent case handling
6. Their preferred tone (formal? warm? clinical?)

CONVERSATION STYLE:
- Start warm: "Hi! I'm going to help you set up your AI receptionist. First — what kind of service business is this? A clinic? Salon? Something else?"
- After each answer: acknowledge + naturally flow to next question
- If they describe a service, immediately ask about their most common customer question about it
- Capture their EXACT language for things like appointment confirmation messages
- Ask "what do customers usually ask first when they message you?" — this is gold for FAQ`,

      content_creator: `You are "TrainBot" — a friendly AI business coach helping an online educator/creator set up their AI enrollment bot in under 5 minutes.

YOUR PERSONALITY: Enthusiastic, smart, fast. Like a fellow creator who gets it.

YOUR MISSION: Extract everything the live bot needs to enroll students confidently. The live bot's job is to pitch the right course, handle objections, collect name/email/interest, and convert. You need to understand:
1. What courses/products they offer + who their student is
2. Pricing, enrollment process, access details
3. Common objections ("is it worth it?", "I'm a beginner", "when does it start?")
4. Their creator voice and style
5. Refund policy + support channel

CONVERSATION STYLE:
- Start: "Hey! Let's get your AI enrollment assistant set up. What's the main course or product you're selling right now?"
- After each answer: dig into the transformation ("what does a student's life look like AFTER your course?") — this is what sells
- Ask about the #1 objection and their best answer to it
- Capture their exact pitch language`,
    };

    const offLimitsByCategory: Record<string, string> = {
      ecommerce: `NEVER ask about appointments, service areas, course enrollment, or clinic hours. ONLY ecommerce topics.`,
      service: `NEVER ask about delivery, product returns, course refunds, or shopkeeper-style orders. ONLY service/booking topics.`,
      content_creator: `NEVER ask about delivery, physical returns, or appointment booking. ONLY course/content topics.`,
    };

    const languageRule = chatLangName
      ? `\nLANGUAGE LOCK: ALWAYS reply ONLY in ${chatLangName}. The user explicitly chose ${chatLangName}. Do NOT switch languages even if the user writes in another language. Only switch if they explicitly ask.`
      : `\nMirror the user's language naturally (English/Spanish/Korean/Bangla/Banglish).`;

    // Optional auto-analysis context — gives the wizard real evidence to reference
    let analysisBlock = "";
    if (analysis_context && typeof analysis_context === "object") {
      const a = analysis_context as any;
      const trimmed = {
        tone_summary: a.tone_summary,
        top_questions: Array.isArray(a.top_questions) ? a.top_questions.slice(0, 6) : [],
        wizard_openers: Array.isArray(a.wizard_openers) ? a.wizard_openers.slice(0, 6) : [],
        draft_settings: a.draft_settings || {},
        never_say: Array.isArray(a.never_say) ? a.never_say.slice(0, 5) : [],
        stats: a.stats || {},
      };
      analysisBlock = `\n\nAUTO-ANALYSIS OF THIS PAGE'S REAL PAST CHATS (use this as ground truth — do NOT re-discover it, REFERENCE it when asking):\n${JSON.stringify(trimmed).slice(0, 4000)}\n\nWhen you ask a question, cite the evidence in plain language (e.g. "I noticed 12 customers asked about delivery and you usually reply '3-5 days, flat $5'. Want me to lock that in?"). Walk through wizard_openers one at a time in order — never ask all at once.`;
    }

    const systemPrompt = `${wizardByCategory[cat]}
${offLimitsByCategory[cat]}
${languageRule}

ALREADY CONFIGURED (DO NOT ASK ABOUT THESE AGAIN):
${knownSummary}

STILL NEED TO COVER (work through these naturally in conversation, NOT as a list):
${missingList}

${businessName ? `The business name is "${businessName}" — use it naturally in conversation.` : ""}
${analysisBlock}

SMART CONVERSATION RULES:
- Ask 1 question at a time MAX. Never list multiple questions together.
- React genuinely to answers: "Perfect!", "That's really helpful!", "Nice — so basically..."
- After getting an answer, ALWAYS briefly repeat it back in your own words to confirm: "Got it, so for delivery you do X — locking that in."
- If an answer is vague, ask ONE sharp follow-up: "Can you give me an example of that?"
- If they say "I don't know" or "standard", suggest a common option: "Most shops do X — want to go with that?"
- Extract their EXACT words for bot replies. Ask: "What exactly does the bot say when a customer asks about price?"
- When you sense you have enough info on a topic, move on naturally — don't over-ask.
- Keep each reply to 2-3 lines max. Fast and punchy.
- Show personality: this should feel like talking to a smart friend, not filling out a form.

WHEN ALL TOPICS ARE COVERED:
- Do a quick 3-second summary: "Quick recap: [key things]. Does that look right?"
- If they confirm, say: "Your bot is all set! Click Apply Settings above to activate it." 
- End with the exact sentinel on its own line: [[SETUP_COMPLETE]]
- NEVER use [[SETUP_COMPLETE]] until genuinely complete.`;



    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests, please wait a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const rawReply = data.choices?.[0]?.message?.content || "Sorry, I couldn't process that. Please try again.";
    const setupComplete = /\[\[SETUP_COMPLETE\]\]/i.test(rawReply);
    const reply = rawReply.replace(/\[\[SETUP_COMPLETE\]\]/gi, "").trim();

    await logTrainingUsage(req, "google/gemini-2.5-flash");
    return new Response(JSON.stringify({ reply, setup_complete: setupComplete }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Training chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
