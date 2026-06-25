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

    const { searchParams } = new URL(req.url);
    const requestedPageId = searchParams.get("fb_page_id");

    // Find a page the user can access (owner or member). Prefer the requested one.
    let query = supabase
      .from("fb_pages")
      .select("*")
      .eq("is_active", true);
    if (requestedPageId) query = query.eq("fb_page_id", requestedPageId);

    const { data: pages, error: pageError } = await query.limit(5);

    let page = null as any;
    if (pages?.length) {
      for (const p of pages) {
        const { data: ok } = await supabase.rpc("user_has_fb_page_access", { _fb_page_id: p.fb_page_id });
        if (ok) { page = p; break; }
      }
    }

    if (pageError || !page) {
      return new Response(JSON.stringify({
        error: requestedPageId
          ? "You don't have access to this Facebook page, or it's not connected."
          : "No connected Facebook page found. Connect a page in Settings first.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const after = searchParams.get("after") || "";

    // Fetch posts from Facebook Graph API
    let url = `https://graph.facebook.com/v19.0/${page.fb_page_id}/posts?fields=id,message,created_time,full_picture,attachments{media,type,url}&limit=20&access_token=${page.page_access_token}`;
    if (after) url += `&after=${after}`;

    const fbRes = await fetch(url);
    if (!fbRes.ok) {
      const errBody = await fbRes.text();
      console.error("FB API error:", errBody);
      try {
        const fbErr = JSON.parse(errBody);
        const msg = fbErr?.error?.message || "Failed to fetch Facebook posts";
        throw new Error(msg);
      } catch (parseErr) {
        throw new Error("Failed to fetch Facebook posts");
      }
    }

    const fbData = await fbRes.json();

    // Get already-imported post IDs
    const postIds = (fbData.data || []).map((p: any) => p.id);
    const { data: existing } = await supabase
      .from("pending_products")
      .select("fb_post_id")
      .eq("user_id", user.id)
      .in("fb_post_id", postIds);

    const { data: existingProducts } = await supabase
      .from("products")
      .select("id")
      .eq("user_id", user.id);

    const importedIds = new Set((existing || []).map((e: any) => e.fb_post_id));

    // Format posts
    const posts = (fbData.data || []).map((post: any) => {
      let imageUrl = post.full_picture || null;
      const attachments = post.attachments?.data || [];
      const hasImage = !!imageUrl || attachments.some((a: any) => a.type === "photo" || a.type === "cover_photo");

      return {
        id: post.id,
        message: post.message || "",
        created_time: post.created_time,
        image_url: imageUrl,
        has_image: hasImage,
        already_imported: importedIds.has(post.id),
      };
    });

    return new Response(JSON.stringify({
      posts,
      paging: fbData.paging || null,
    }), {
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
