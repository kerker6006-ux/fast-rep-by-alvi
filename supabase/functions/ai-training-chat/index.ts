import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, action, settings, category } = await req.json();
    const cat: string = (category && ["ecommerce", "dental", "hvac", "salon"].includes(category)) ? category : "ecommerce";
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

      return new Response(JSON.stringify({ faqs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const currentSettingsSummary = settings ? Object.entries(settings)
      .filter(([_, v]) => v && String(v).trim())
      .map(([k, v]) => `${k}: ${String(v).slice(0, 200)}`)
      .join("\n") : "No settings configured yet.";

    const wizardByCategory: Record<string, string> = {
      ecommerce: `You are training an AI Shopkeeper for a Facebook Messenger online store.
Ask 1-2 questions at a time about: business name, what they sell, bot tone, delivery info, payment methods, return policy, top FAQs, things the bot should never say, order collection style.
DO NOT ask about appointments, insurance, service area, or clinic hours.`,
      dental: `You are training an AI Receptionist for a DENTAL CLINIC.
Ask 1-2 questions at a time about: clinic name, operating hours, address, insurance accepted, emergency policy, cancellation policy, common patient FAQs, things the bot should never say, and what info to collect to book an appointment (name, phone, preferred date, service).
DO NOT ask about delivery, returns, payment methods, product catalog, or order collection.`,
      hvac: `You are training an AI Dispatcher for an HVAC / HOME-SERVICES company.
Ask 1-2 questions at a time about: company name, operating hours, service area / zip codes, emergency availability, pricing / estimate policy, common job-type FAQs, things the bot should never say, and what info to collect to dispatch a job (name, phone, address, service needed, preferred visit date).
DO NOT ask about delivery, returns, product catalog, or shopkeeper-style orders.`,
      salon: `You are training an AI Receptionist for a BEAUTY SALON / MED SPA.
Ask 1-2 questions at a time about: salon name, operating hours, address, cancellation policy, deposit policy, common treatment FAQs, things the bot should never say, and what info to collect to book an appointment (name, phone, service, preferred date).
DO NOT ask about delivery, returns, payment methods for goods, product catalog, or shopkeeper-style orders.`,
    };

    const systemPrompt = `${wizardByCategory[cat]}

CURRENT BOT SETTINGS:
${currentSettingsSummary}

RULES FOR YOU:
- Ask 1-2 questions at a time, NOT all at once.
- Use simple language. Be encouraging and make it feel easy.
- After each answer, briefly acknowledge it and move to the next missing piece.
- Mirror the user's language (English/Spanish/Korean/Bangla).
- Keep YOUR messages short (3-4 lines max).
- If existing settings cover a topic, ask "Is this still correct or should we change it?"
- When you've covered enough, say "I think we have a great setup! Want me to save these settings?"`;


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
