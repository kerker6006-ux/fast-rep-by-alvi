import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "AQ.Ab8RN6JPAkC-US2oy7vl28rRCTz9aes6EjHbOPN0hR-vsGAFSg";

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
    const url: string = body.url;
    const maxPages: number = Math.min(body.maxPages || 50, 100);
    const importProducts: boolean = body.importProducts !== false;
    if (!url) throw new Error("url required");

    // Step 1: Crawl site
    const crawlStart = await fetch(`${FIRECRAWL_V2}/crawl`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        limit: maxPages,
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });
    const crawlJson = await crawlStart.json();
    if (!crawlStart.ok) throw new Error(`Crawl start failed: ${JSON.stringify(crawlJson).slice(0, 300)}`);

    const jobId = crawlJson.id;
    if (!jobId) throw new Error("No crawl job id");

    // Step 2: Poll until done (up to ~3 min)
    let result: any = null;
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const s = await fetch(`${FIRECRAWL_V2}/crawl/${jobId}`, {
        headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}` },
      });
      const sj = await s.json();
      if (sj.status === "completed") { result = sj; break; }
      if (sj.status === "failed") throw new Error("Crawl failed");
    }
    if (!result) throw new Error("Crawl timeout");

    const pages = (result.data || []) as any[];
    let savedKnowledge = 0;
    let savedProducts = 0;

    // Step 3: Save each page as knowledge
    for (const p of pages) {
      const md = (p.markdown || "").slice(0, 20000);
      const meta = p.metadata || {};
      const pageUrl = meta.sourceURL || meta.url || meta.ogUrl;
      if (!pageUrl || !md) continue;

      await service.from("website_knowledge").upsert({
        user_id: user.id,
        source_url: url,
        page_url: pageUrl,
        title: meta.title || null,
        content: md,
        summary: (meta.description || md.slice(0, 300)),
      }, { onConflict: "user_id,page_url" });
      savedKnowledge++;
    }

    // Step 4: Try to detect product pages using AI and import
    if (importProducts && GEMINI_API_KEY && pages.length > 0) {
      // Build compact list
      const candidates = pages
        .map((p, i) => ({
          idx: i,
          url: p.metadata?.sourceURL || "",
          title: p.metadata?.title || "",
          excerpt: (p.markdown || "").slice(0, 600),
        }))
        .filter((c) => c.url);

      // Ask AI to identify product pages
      let picks: number[] = [];
      try {
        const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
          body: JSON.stringify({
            model: "gemini-2.5-flash-lite",
            messages: [{
              role: "user",
              content: `Identify which of these pages are individual product pages (not category, home, blog, contact). Return JSON: {"picks":[idx,...]}. Max 30.\n\n${JSON.stringify(candidates)}`,
            }],
            response_format: { type: "json_object" },
          }),
        });
        const aj = await aiRes.json();
        picks = JSON.parse(aj.choices?.[0]?.message?.content || "{}").picks || [];
      } catch (e) { console.error("AI pick failed", e); }

      // Extract product details for each
      for (const idx of picks.slice(0, 30)) {
        const p = pages[idx];
        if (!p) continue;
        try {
          const md = (p.markdown || "").slice(0, 4000);
          const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
            body: JSON.stringify({
              model: "gemini-2.5-flash",
              messages: [{
                role: "user",
                content: `Extract product info from this page. Return JSON: {name, name_bn, description, description_bn, category, price (number USD, 0 if unknown), image_url (best product image url), keywords (array)}.\n\nURL: ${p.metadata?.sourceURL}\nTitle: ${p.metadata?.title}\n\n${md}`,
              }],
              response_format: { type: "json_object" },
            }),
          });
          const aj = await aiRes.json();
          const pd = JSON.parse(aj.choices?.[0]?.message?.content || "{}");
          if (!pd.name) continue;

          await service.from("pending_products").insert({
            user_id: user.id,
            fb_post_id: p.metadata?.sourceURL,
            image_url: pd.image_url || p.metadata?.ogImage || null,
            post_caption: (p.metadata?.title || "") + " - " + (p.metadata?.description || ""),
            ai_name: pd.name,
            ai_name_bn: pd.name_bn || null,
            ai_description: pd.description || null,
            ai_description_bn: pd.description_bn || null,
            ai_category: pd.category || null,
            ai_price: Number(pd.price) || 0,
            ai_keywords: pd.keywords || [],
            status: "pending",
          });
          savedProducts++;
        } catch (e) { console.error("Product extract failed", e); }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      pages_scraped: pages.length,
      knowledge_saved: savedKnowledge,
      products_imported: savedProducts,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("scrape-website error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
