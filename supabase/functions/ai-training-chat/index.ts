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
    const { messages, action, settings, category, language } = await req.json();
    const cat: string = (category && ["ecommerce", "dental", "hvac", "salon"].includes(category)) ? category : "ecommerce";
    const LANG_NAMES: Record<string, string> = { en: "English", bn: "Bangla (বাংলা)", es: "Spanish (Español)", ko: "Korean (한국어)" };
    const chatLang: string = (language && LANG_NAMES[language]) ? language : (settings?.training_chat_language && LANG_NAMES[settings.training_chat_language] ? settings.training_chat_language : "");
    const chatLangName = chatLang ? LANG_NAMES[chatLang] : "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
              content: `You are a settings generator. Based on the training conversation, extract bot configuration settings.
              
Return a JSON object with these keys (only include keys that were discussed):
- bot_name: string
- business_name: string  
- business_description: string
- ai_personality: string (detailed instructions for how the bot should behave, reply style, tone)
- custom_instructions: string (specific rules)
- reply_tone: string
- welcome_message: string (Bangla)
- welcome_message_en: string (English)
- out_of_stock_message: string
- delivery_info: string
- payment_methods: string
- order_instructions: string
- image_instructions: string
- angry_customer_handling: string
- never_say_list: JSON array of strings
- faq_list: JSON array of {q, a} objects
- reply_examples: JSON array of {customer, reply, category} objects

IMPORTANT: 
- Write ai_personality as direct instructions to the bot (e.g. "You are...", "Always...", "Never...")
- Keep it practical and specific
- If user said "reply in Bangla", include that in ai_personality
- never_say_list, faq_list, reply_examples must be JSON strings`
            },
            ...messages,
            {
              role: "user",
              content: "Based on our entire conversation above, generate the complete bot settings as a JSON object. Include everything we discussed."
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
                  welcome_message_en: { type: "string" },
                  out_of_stock_message: { type: "string" },
                  delivery_info: { type: "string" },
                  payment_methods: { type: "string" },
                  order_instructions: { type: "string" },
                  image_instructions: { type: "string" },
                  angry_customer_handling: { type: "string" },
                  never_say_list: { type: "string" },
                  faq_list: { type: "string" },
                  reply_examples: { type: "string" },
                },
                required: ["ai_personality"],
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
      dental: ["business_name", "business_description", "reply_tone", "operating_hours", "business_address", "insurance_accepted", "emergency_policy", "cancellation_policy", "welcome_message", "faq_list", "never_say_list"],
      hvac: ["business_name", "business_description", "reply_tone", "operating_hours", "service_area_zips", "emergency_policy", "pricing_policy", "welcome_message", "faq_list", "never_say_list"],
      salon: ["business_name", "business_description", "reply_tone", "operating_hours", "business_address", "cancellation_policy", "deposit_policy", "welcome_message", "faq_list", "never_say_list"],
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
      ecommerce: `You are training an AI Shopkeeper for a Facebook Messenger online store.`,
      dental: `You are training an AI Receptionist for a DENTAL CLINIC.`,
      hvac: `You are training an AI Dispatcher for an HVAC / HOME-SERVICES company.`,
      salon: `You are training an AI Receptionist for a BEAUTY SALON / MED SPA.`,
    };
    const offLimitsByCategory: Record<string, string> = {
      ecommerce: `DO NOT ask about appointments, insurance, service area, or clinic hours.`,
      dental: `DO NOT ask about delivery, returns, payment methods for goods, product catalog, or order collection.`,
      hvac: `DO NOT ask about delivery, returns, product catalog, or shopkeeper-style orders.`,
      salon: `DO NOT ask about delivery, returns, payment methods for goods, product catalog, or order collection.`,
    };

    const languageRule = chatLangName
      ? `\nLANGUAGE LOCK: ALWAYS reply ONLY in ${chatLangName}. The user explicitly chose ${chatLangName} for this training chat. Do NOT switch languages even if the user writes a single word in another language. Only switch if the user clearly and explicitly asks you to change the chat language (e.g. "switch to English", "change language to Spanish").`
      : `\nMirror the user's language (English/Spanish/Korean/Bangla).`;

    const systemPrompt = `${wizardByCategory[cat]}
${offLimitsByCategory[cat]}
${languageRule}

ALREADY CONFIGURED (DO NOT ASK ABOUT THESE AGAIN — only confirm if the user brings them up):
${knownSummary}

STILL MISSING (ask about these, ONE OR TWO AT A TIME, in this priority order):
${missingList}

${businessName ? `The business name is "${businessName}" — address the owner naturally and never ask for the business name again.` : ""}

RULES FOR YOU:
- Greet briefly${businessName ? ` (use the business name "${businessName}")` : ""}, then jump straight to the FIRST missing field above.
- Ask 1-2 questions at a time, NOT all at once. Keep messages 3-4 lines max.
- After each answer, briefly acknowledge it and move to the next MISSING piece.
- NEVER re-ask anything in the ALREADY CONFIGURED list.
- When the MISSING list is empty, say "Your setup is complete — want me to save?" and stop asking new questions.`;


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
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't process that. Please try again.";

    return new Response(JSON.stringify({ reply }), {
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
