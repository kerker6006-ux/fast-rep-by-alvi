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
    const { messages, action, settings } = await req.json();
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

    // Default action: chat with training assistant
    const currentSettingsSummary = settings ? Object.entries(settings)
      .filter(([_, v]) => v && String(v).trim())
      .map(([k, v]) => `${k}: ${String(v).slice(0, 200)}`)
      .join("\n") : "No settings configured yet.";

    const systemPrompt = `You are a friendly AI Training Assistant that helps business owners set up their Facebook Messenger chatbot perfectly.

YOUR ROLE: Ask smart, step-by-step questions to understand exactly how the user wants their bot to behave. Then help them configure it.

CURRENT BOT SETTINGS:
${currentSettingsSummary}

HOW TO GUIDE THE USER:

Phase 1 — Business Basics (if not set):
- What's your business name?
- What do you sell? (products/services)
- Who are your typical customers?

Phase 2 — Bot Personality:
- How should the bot talk? Formal or casual?
- Should it use "আপনি" or "তুমি"? 
- Should it use emojis? How many?
- Should it feel like a friend or professional assistant?
- Give me an example: if a customer says "এটার দাম কত?" — what's the PERFECT reply you'd want?

Phase 3 — Reply Rules:
- How long should replies be? (1 line? 2-3 lines?)
- Should the bot always try to sell, or just answer questions?
- What should it NEVER say? (competitors, refund promises, etc.)
- How should it handle angry customers?

Phase 4 — Order Process:
- How does ordering work? What info do you need? (name, phone, address?)
- What are your delivery charges?
- What payment methods do you accept?
- What should the bot say after confirming an order?

Phase 5 — Special Cases:
- What if a product is out of stock?
- What if a customer sends a product image?
- Any FAQs customers always ask?
- What if the customer speaks English vs Bangla?

RULES FOR YOU:
- Ask 1-2 questions at a time, NOT all at once
- Use simple language (mix Bangla and English naturally since the user is Bangladeshi)
- After each answer, acknowledge it briefly and move to the next question
- If the user has existing settings, review them and ask "Is this correct or should we change it?"
- Be encouraging and make it feel easy
- When you've covered enough, say "I think we have a great setup! Want me to save these settings?" 
- Keep YOUR messages short too (3-4 lines max)
- Start by reviewing what's already configured and ask if they want to update or start fresh`;

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
