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

    let pageId: string | null = null;
    if (fb_page_id) {
      const { data: canAccess } = await supabase.rpc("user_has_page_access", { _page_id: fb_page_id });
      if (!canAccess) {
        return new Response(JSON.stringify({ error: "You don't have access to this Facebook page, or it's not connected." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pageId = fb_page_id;
    }

    // Check if already imported
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

    // Use AI to analyze the post
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    let aiData: any = {};

    if (GEMINI_API_KEY && image_url) {
      try {
        const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${GEMINI_API_KEY}` },
          body: JSON.stringify({
            model: "gemini-2.5-flash-lite",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: `Analyze this product image${message ? ` with caption: "${message}"` : ""}. Return JSON with: name (English), name_bn (Bangla), description (English), description_bn (Bangla), category, color, material, price (number, 0 if unknown), keywords (array). Be accurate about color.` },
                  { type: "image_url", image_url: { url: image_url } },
                ],
              },
            ],
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

    // Insert as pending product
    const { error: insertError } = await supabase.from("pending_products").insert({
      user_id: user.id,
      fb_page_id: pageId,
      fb_post_id: post_id,
      image_url: image_url || null,
      post_caption: message || null,
      ai_name: aiData.name || null,
      ai_name_bn: aiData.name_bn || null,
      ai_description: aiData.description || null,
      ai_description_bn: aiData.description_bn || null,
      ai_category: aiData.category || null,
      ai_color: aiData.color || null,
      ai_price: aiData.price || 0,
      ai_material: aiData.material || null,
      ai_keywords: aiData.keywords || [],
      status: "pending",
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
