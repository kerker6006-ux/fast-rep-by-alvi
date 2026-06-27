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
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const action: "analyze" | "chat" | "auto_import" = body.action || "analyze";
    const question: string = body.question || "";
    const history: any[] = body.history || [];

    // Get FB page
    const { data: pages } = await supabase
      .from("fb_pages")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1);
    if (!pages?.length) throw new Error("No connected Facebook page");
    const page = pages[0];

    // Fetch up to 50 recent posts
    const url = `https://graph.facebook.com/v21.0/${page.fb_page_id}/posts?fields=id,message,created_time,full_picture&limit=50&access_token=${page.page_access_token}`;
    const fbRes = await fetch(url);
    if (!fbRes.ok) {
      const t = await fbRes.text();
      let msg = "Failed to fetch posts";
      try { msg = JSON.parse(t)?.error?.message || msg; } catch {}
      throw new Error(msg);
    }
    const fbData = await fbRes.json();
    const allPosts = (fbData.data || []) as any[];

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("AI not configured");

    // Build compact post summary for context
    const postsSummary = allPosts.map((p, i) => ({
      idx: i,
      id: p.id,
      caption: (p.message || "").slice(0, 300),
      has_image: !!p.full_picture,
      image_url: p.full_picture || null,
      date: p.created_time,
    }));

    // ===== ACTION: analyze =====
    if (action === "analyze") {
      const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You analyze a Facebook business page. Reply in Bangla (বাংলা). Be concise.",
            },
            {
              role: "user",
              content: `Page: ${page.page_name}\nAnalyze these ${postsSummary.length} posts and return a JSON object with these keys:\n- summary: 2-3 sentence overview of what this page sells\n- categories: array of product categories detected\n- recommended_imports: array of post indexes (idx) that look like clear product posts worth importing (max 15)\n- insights: array of 3-5 short useful insights/observations\n- questions_user_might_ask: array of 3 suggested questions the page owner might want to ask\n\nPosts:\n${JSON.stringify(postsSummary)}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!aiRes.ok) {
        const t = await aiRes.text();
        throw new Error(`AI error: ${t.slice(0, 200)}`);
      }
      const aiJson = await aiRes.json();
      const content = aiJson.choices?.[0]?.message?.content || "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(content); } catch { parsed = { summary: content }; }

      // Map recommended idx back to posts
      const recommendedPosts = (parsed.recommended_imports || [])
        .map((i: number) => postsSummary[i])
        .filter(Boolean);

      return new Response(JSON.stringify({
        ...parsed,
        recommended_posts: recommendedPosts,
        total_posts: allPosts.length,
        page_name: page.page_name,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== ACTION: chat =====
    if (action === "chat") {
      const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are an assistant analyzing the Facebook page "${page.page_name}". Answer in Bangla unless user writes in English. Use the post data provided. Be concise.\n\nPage posts data:\n${JSON.stringify(postsSummary)}`,
            },
            ...history,
            { role: "user", content: question },
          ],
        }),
      });

      if (!aiRes.ok) {
        const t = await aiRes.text();
        throw new Error(`AI error: ${t.slice(0, 200)}`);
      }
      const aiJson = await aiRes.json();
      const reply = aiJson.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== ACTION: auto_import =====
    if (action === "auto_import") {
      // Find posts with images that aren't already imported
      const postIds = postsSummary.map(p => p.id);
      const { data: existing } = await supabase
        .from("pending_products")
        .select("fb_post_id")
        .eq("user_id", user.id)
        .in("fb_post_id", postIds);
      const importedIds = new Set((existing || []).map((e: any) => e.fb_post_id));

      const candidates = postsSummary.filter(p => p.has_image && !importedIds.has(p.id));

      // Let AI pick best candidates (up to 10)
      let picks: number[] = [];
      try {
        const pickRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
          body: JSON.stringify({
            model: "gemini-2.5-flash-lite",
            messages: [{
              role: "user",
              content: `From these posts, return a JSON array of 'idx' values (max 10) that look like clear product posts (not announcements, not memes). Return just: {"picks":[...]}\n\n${JSON.stringify(candidates.map(c => ({ idx: c.idx, caption: c.caption })))}`,
            }],
            response_format: { type: "json_object" },
          }),
        });
        const pj = await pickRes.json();
        picks = JSON.parse(pj.choices?.[0]?.message?.content || "{}").picks || [];
      } catch {
        picks = candidates.slice(0, 10).map(c => c.idx);
      }

      const toImport = picks.map(i => postsSummary[i]).filter(Boolean).slice(0, 10);
      let imported = 0;

      for (const post of toImport) {
        try {
          // Analyze each post
          const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
            body: JSON.stringify({
              model: "gemini-2.5-flash-lite",
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: `Analyze this product image with caption: "${post.caption}". Return JSON: {name, name_bn, description, description_bn, category, color, material, price (number), keywords (array)}.` },
                  ...(post.image_url ? [{ type: "image_url", image_url: { url: post.image_url } }] : []),
                ],
              }],
              response_format: { type: "json_object" },
            }),
          });
          const aiJson = await aiRes.json();
          const aiData = JSON.parse(aiJson.choices?.[0]?.message?.content || "{}");

          await service.from("pending_products").insert({
            user_id: user.id,
            fb_post_id: post.id,
            image_url: post.image_url,
            post_caption: post.caption,
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
          imported++;
        } catch (e) {
          console.error("Import failed for", post.id, e);
        }
      }

      return new Response(JSON.stringify({ imported, attempted: toImport.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
