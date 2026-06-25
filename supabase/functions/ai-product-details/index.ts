import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { name, category, color, size, material, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const lang = language === "bn" ? "Bengali (বাংলা)" : "English";

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
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
            content: `You are a product copywriter for an e-commerce store. Write compelling, concise product descriptions in ${lang}. 
Keep it 2-3 sentences max. Be persuasive and highlight key features. Do NOT add any markdown formatting, just plain text.
Also generate 5-8 relevant search keywords (comma separated) that customers might use to find this product.
Return JSON: {"description": "...", "keywords": "..."}`
          },
          {
            role: "user",
            content: `Product: ${name}
Category: ${category || "General"}
Color: ${color || "N/A"}
Size: ${size || "N/A"}
Material: ${material || "N/A"}`
          }
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { description: content, keywords: "" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-product-details error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
