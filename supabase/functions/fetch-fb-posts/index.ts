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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { searchParams } = new URL(req.url);
    const requestedPageId = searchParams.get("fb_page_id");

    // Fetch page token with service role, then validate the authenticated user's access manually.
    // The client/user role cannot read page_access_token, so using the normal client here can
    // falsely look like "page not connected" even when the page exists.
    let page = null as any;

    if (requestedPageId) {
      const { data: requestedPages, error: pageError } = await admin
        .from("fb_pages")
        .select("*")
        .eq("is_active", true)
        .or(`fb_page_id.eq.${requestedPageId},id.eq.${requestedPageId}`)
        .limit(1);

      if (pageError) throw pageError;
      page = requestedPages?.[0] ?? null;

      if (page && page.user_id !== user.id) {
        const { data: member } = await admin
          .from("page_members")
          .select("id")
          .eq("page_id", page.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!member) page = null;
      }
    } else {
      const { data: ownedPages, error: ownedError } = await admin
        .from("fb_pages")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1);

      if (ownedError) throw ownedError;
      page = ownedPages?.[0] ?? null;

      if (!page) {
        const { data: membership, error: memberError } = await admin
          .from("page_members")
          .select("page_id")
          .eq("user_id", user.id)
          .limit(1);
        if (memberError) throw memberError;

        if (membership?.[0]?.page_id) {
          const { data: sharedPage, error: sharedError } = await admin
            .from("fb_pages")
            .select("*")
            .eq("id", membership[0].page_id)
            .eq("is_active", true)
            .maybeSingle();
          if (sharedError) throw sharedError;
          page = sharedPage;
        }
      }
    }

    if (!page) {
      return new Response(JSON.stringify({
        error: requestedPageId
          ? "You don't have access to this Facebook page, or it's not connected."
          : "No connected Facebook page found. Connect a page in Settings first.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!page.page_access_token) {
      return new Response(JSON.stringify({
        error: "This Facebook page is connected but its access token is missing. Reconnect the page, then try again.",
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
