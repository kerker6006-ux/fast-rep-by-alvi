import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("No auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { post_id, message, image_url, fb_page_id } = await req.json();
    if (!post_id) throw new Error("post_id required");
    if (!message && !image_url) throw new Error("Post has no caption or image to analyze");

    let pageId: string | null = null;
    if (fb_page_id) {
      const { data: canAccess } = await supabase.rpc("user_has_page_access", { _page_id: fb_page_id });
      if (!canAccess) {
        return new Response(JSON.stringify({ error: "You don't have access to this Facebook page." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pageId = fb_page_id;
    }

    const { data: existing } = await supabase
      .from("pending_products")
      .select("id")
      .eq("fb_post_id", post_id)
      .eq("user_id", user.id)
      .limit(1);

    if (existing?.length) {
      return new Response(JSON.stringify({ error: "Already imported" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("GEMINI_API_KEY");
    let aiData: any = {};

    if (LOVABLE_API_KEY) {
      try {
        const prompt = `You are extracting a SERVICE (not a physical product) from a Facebook post. Focus on what the service does, who it helps, and the problems it solves. Return STRICT JSON only with keys:
- name: short service name (English)
- name_bn: same name in Bangla script (optional)
- description: 1-3 sentences describing what the service is, who it's for, common problems it solves (English)
- description_bn: same in Bangla (optional)
- category: short free-text label like "Consultation", "Repair", "Installation", "Treatment", "Package" (the AI picks the best fit)
- price_text: price as a string, e.g. "$500", "৳1500 - ৳3000", or "Contact for quote" if unknown
- duration_text: e.g. "45 min", "1 hour" or null
- keywords: array of 5-15 lowercase terms (English + Bangla) a customer might use when asking about this service${message ? `\n\nPost caption: """${message}"""` : ""}`;

        const content: any[] = [{ type: "text", text: prompt }];
        if (image_url) content.push({ type: "image_url", image_url: { url: image_url } });

        const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: "gemini-2.5-flash-lite",
            messages: [{ role: "user", content }],
          }),
        });

        if (aiRes.ok) {
          const aiJson = await aiRes.json();
          const text = aiJson.choices?.[0]?.message?.content || "";
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) aiData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("AI analysis failed:", e);
      }
    }

    const { error: insertError } = await supabase.from("pending_products").insert({
      user_id: user.id,
      fb_page_id: pageId,
      fb_post_id: post_id,
      image_url: image_url || null,
      post_caption: message || null,
      kind: "service",
      ai_name: aiData.name || null,
      ai_name_bn: aiData.name_bn || null,
      ai_description: aiData.description || null,
      ai_description_bn: aiData.description_bn || null,
      ai_category: aiData.category || null,
      ai_price: 0,
      ai_price_text: aiData.price_text || null,
      ai_duration_text: aiData.duration_text || null,
      ai_keywords: Array.isArray(aiData.keywords) ? aiData.keywords : [],
      status: "pending",
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
