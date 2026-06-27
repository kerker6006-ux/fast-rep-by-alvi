import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, image_urls, language } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const langMap: Record<string, string> = {
      en: "English",
      bn: "Bangla (Bengali)",
      ko: "Korean",
      es: "Spanish",
    };
    const replyLang = langMap[(language || "en").toLowerCase()] || "English";

    // Build image content parts for multimodal
    const imageContents: any[] = [];
    if (image_urls && image_urls.length > 0) {
      for (const url of image_urls) {
        imageContents.push({
          type: "image_url",
          image_url: { url }
        });
      }
    }

    const systemPrompt = `You are a Product Setup Assistant for an e-commerce store. You help the store owner set up their products perfectly through conversation.

REPLY LANGUAGE: ALWAYS reply in ${replyLang}. Do NOT mix languages. Keep examples and questions in ${replyLang}.

Your job:
1. When the owner uploads a product image, ANALYZE it deeply:
   - Detect the product type (t-shirt, dress, bag, hijab, etc.)
   - Detect colors visible in the image (be very specific: "dusty rose", "cream white", "forest green")
   - Detect material if visible (chiffon, silk, cotton, georgette, etc.)
   - Detect any patterns or special features
   - Estimate the size category if possible

2. Ask smart follow-up questions ONE AT A TIME to fill in missing details:
   - What price do you want to set?
   - What category should I put this in?
   - Any specific size details?
   - Should I add this to an existing product as a color variant?

3. When you have enough info, generate a PRODUCT JSON with all details filled in.

RULES:
- Be conversational, friendly, and SHORT (1-2 sentences per response)
- Reply ONLY in ${replyLang}
- When you detect a color from image, be VERY specific and accurate
- Always suggest a category based on what you see
- When generating final product data, return it as a JSON block

When you have enough information to create/update the product, include a JSON block in your response like this:
\`\`\`json
{
  "action": "create_product",
  "product": {
    "name": "Product Name in English",
    "name_bn": "",
    "description": "English description",
    "description_bn": "",
    "price": 0,
    "category": "Category",
    "color": "Main Color",
    "size": "",
    "material": "Material type",
    "keywords": "keyword1, keyword2, keyword3",
    "is_active": true,
    "detected_colors": ["Color 1", "Color 2"]
  }
}
\`\`\`

If the image shows a specific color variant for an existing product:
\`\`\`json
{
  "action": "add_variant",
  "variant": {
    "color": "Detected Color Name",
    "product_name": "Parent product name"
  }
}
\`\`\`

Keep field "name" always in English. Only include the JSON when you're confident you have enough info. Otherwise keep asking questions in ${replyLang}.`;

    // Build the messages for the AI
    const aiMessages: any[] = [
      { role: "system", content: systemPrompt }
    ];

    // Add conversation history
    for (const msg of messages) {
      if (msg.role === "user" && msg.image_urls && msg.image_urls.length > 0) {
        // Multimodal message with images
        const content: any[] = [];
        if (msg.content) {
          content.push({ type: "text", text: msg.content });
        }
        for (const url of msg.image_urls) {
          content.push({ type: "image_url", image_url: { url } });
        }
        aiMessages.push({ role: "user", content });
      } else {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        messages: aiMessages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Try to extract JSON from the response
    let extractedData = null;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        extractedData = JSON.parse(jsonMatch[1]);
      } catch { /* ignore parse errors */ }
    }

    return new Response(JSON.stringify({
      reply: content,
      extracted_data: extractedData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-product-wizard error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
