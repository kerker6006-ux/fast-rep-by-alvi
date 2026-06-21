import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify token is now per-page, stored in fb_pages table

const IMAGE_REQUEST_KEYWORDS = [
  "pic", "picture", "photo", "image", "photos", "images",
  "ছবি", "পিক", "ফটো", "ইমেজ", "দেখাও", "দেখি", "পিক দাও", "ছবি দাও",
  "send pic", "send picture", "show pic", "show picture", "show image",
  "dekhi", "dekhao", "chobi", "picture dekhi",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);

  // Facebook webhook verification (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token) {
      // Look up any fb_page with this verify_token
      const { data: matchingPage } = await supabase
        .from("fb_pages")
        .select("id")
        .eq("verify_token", token)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (matchingPage) {
        console.log("Webhook verified for page:", matchingPage.id);
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // Facebook sends POST with messages
  if (req.method === "POST") {
    try {
      const rawBody = await req.text();

      // ===== Verify X-Hub-Signature-256 against FB_APP_SECRET =====
      const FB_APP_SECRET = Deno.env.get("FB_APP_SECRET");
      if (FB_APP_SECRET) {
        const sigHeader = req.headers.get("x-hub-signature-256") || "";
        const expectedPrefix = "sha256=";
        if (!sigHeader.startsWith(expectedPrefix)) {
          console.warn("Webhook rejected: missing x-hub-signature-256");
          return new Response("Forbidden", { status: 403, headers: corsHeaders });
        }
        const provided = sigHeader.slice(expectedPrefix.length);
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(FB_APP_SECRET),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const sigBytes = new Uint8Array(
          await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)),
        );
        const computed = Array.from(sigBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
        // constant-time compare
        let ok = computed.length === provided.length;
        for (let i = 0; i < computed.length && i < provided.length; i++) {
          ok = ok && (computed.charCodeAt(i) === provided.charCodeAt(i));
        }
        if (!ok) {
          console.warn("Webhook rejected: invalid x-hub-signature-256");
          return new Response("Forbidden", { status: 403, headers: corsHeaders });
        }
      } else {
        console.warn("FB_APP_SECRET not set — webhook signature verification skipped");
      }

      const body = JSON.parse(rawBody);
      console.log("Received webhook:", JSON.stringify(body).slice(0, 500));

      const isInstagram = body.object === "instagram";
      if (body.object !== "page" && !isInstagram) {
        return new Response("Not a page/instagram event", { status: 200, headers: corsHeaders });
      }

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

      for (const entry of body.entry || []) {
        const entryId = entry.id;

        // Lookup the owning fb_pages row.
        // For "page" object: entry.id is the FB Page ID.
        // For "instagram" object: entry.id is the IG Business Account ID.
        const lookupColumn = isInstagram ? "ig_business_account_id" : "fb_page_id";
        const { data: fbPage } = await supabase
          .from("fb_pages")
          .select("user_id, page_access_token, is_active, fb_page_id, ig_business_account_id")
          .eq(lookupColumn, entryId)
          .eq("is_active", true)
          .maybeSingle();

        if (!fbPage) {
          // Fallback to global token for backward compatibility (FB-only)
          const fallbackToken = Deno.env.get("FB_PAGE_ACCESS_TOKEN");
          if (isInstagram || !fallbackToken) {
            console.error("No fb_page found for", lookupColumn, entryId);
            continue;
          }
          const { data: anyPage } = await supabase
            .from("fb_pages")
            .select("user_id")
            .eq("is_active", true)
            .limit(1)
            .maybeSingle();
          const fallbackUserId = anyPage?.user_id || null;
          const fallbackSettings = fallbackUserId ? await loadSettings(supabase, fallbackUserId) : {};
          console.log("Using fallback token with user_id:", fallbackUserId);
          for (const event of entry.messaging || []) {
            await handleMessagingEvent(supabase, event, entryId, fallbackToken, LOVABLE_API_KEY, fallbackSettings, fallbackUserId, "facebook");
          }
          continue;
        }

        const PAGE_ACCESS_TOKEN = fbPage.page_access_token;
        const userId = fbPage.user_id;
        const platform: "facebook" | "instagram" = isInstagram ? "instagram" : "facebook";
        // For IG, use IG account id as "pageId" identity in send helpers
        const selfId = isInstagram ? fbPage.ig_business_account_id : fbPage.fb_page_id;

        // Load user-specific settings
        const settings = await loadSettings(supabase, userId);

        // Check if bot is disabled
        if (settings.bot_enabled === "false") {
          console.log("Bot is disabled for user:", userId);
          continue;
        }

        // Handle messaging events (DMs) — same shape on FB and IG
        for (const event of entry.messaging || []) {
          await handleMessagingEvent(supabase, event, selfId, PAGE_ACCESS_TOKEN, LOVABLE_API_KEY, settings, userId, platform);
        }

        // Handle changes (FB feed + IG comments)
        for (const change of entry.changes || []) {
          if (isInstagram) {
            if (change.field === "comments") {
              await handleIgCommentEvent(supabase, change.value, PAGE_ACCESS_TOKEN, settings, userId, LOVABLE_API_KEY, selfId);
            }
            // Future: mentions, message_reactions
          } else if (change.field === "feed") {
            if (change.value?.item === "comment") {
              // 1) Run user-defined keyword triggers first (ManyChat-style)
              await handleCommentTriggers(supabase, change.value, PAGE_ACCESS_TOKEN, userId, entryId);
              // 2) Then fall through to AI/text comment auto-reply
              await handleCommentEvent(supabase, change.value, PAGE_ACCESS_TOKEN, settings, userId, LOVABLE_API_KEY);
            } else if (change.value?.item === "photo" || change.value?.item === "status") {
              await handlePagePostEvent(supabase, change.value, userId, LOVABLE_API_KEY, entryId, settings);
            }
          }
        }
      }

      return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("EVENT_RECEIVED", { status: 200, headers: corsHeaders });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});

// ---- Settings ----

async function loadSettings(supabase: any, userId: string | null): Promise<Record<string, string>> {
  let query = supabase.from("bot_settings").select("setting_key, setting_value");
  if (userId) {
    query = query.eq("user_id", userId);
  }
  const { data: settingsRows } = await query;
  const settings: Record<string, string> = {};
  settingsRows?.forEach((s: any) => { settings[s.setting_key] = s.setting_value; });
  return settings;
}

// ---- Comment Handler ----

async function handleCommentEvent(
  supabase: any, value: any, pageAccessToken: string, settings: Record<string, string>,
  userId: string | null, lovableApiKey: string | undefined
) {
  if (settings.comment_auto_reply !== "true") return;
  if (value.from?.id === value.post_id?.split("_")[0]) return;

  const commentId = value.comment_id;
  if (!commentId) return;

  const commentText = value.message || "";
  const isBangla = /[\u0980-\u09FF]/.test(commentText);

  let replyText: string;

  // Use AI for smart comment replies if available
  if (lovableApiKey && settings.comment_ai_reply === "true") {
    try {
      // Load products for context
      let productQuery = supabase.from("products").select("name, name_bn, price, category").eq("is_active", true);
      if (userId) productQuery = productQuery.eq("user_id", userId);
      const { data: products } = await productQuery;

      const productList = (products || []).map((p: any) => `${p.name}: ৳${p.price}`).join(", ");
      const lang = isBangla ? "Bangla" : "English";

      const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableApiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{
            role: "system",
            content: `You are a Facebook page comment reply bot. Reply in ${lang}. Be short (1 sentence max). If they ask about a product, mention the price. Always encourage them to inbox for details. Products: ${productList}. ${settings.manual_instructions || ""}`
          }, {
            role: "user",
            content: `Comment: "${commentText}"`
          }],
          max_tokens: 100,
        }),
      });
      const aiData = await aiRes.json();
      replyText = aiData.choices?.[0]?.message?.content?.trim() || "";
    } catch (e) {
      console.error("AI comment reply error:", e);
      replyText = "";
    }
  } else {
    replyText = "";
  }

  if (!replyText) {
    replyText = isBangla
      ? (settings.comment_reply_text || "ধন্যবাদ! বিস্তারিত জানতে আমাদের পেজে ইনবক্স করুন 📩")
      : (settings.comment_reply_text_en || "Thanks! Please inbox us for details 📩");
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${commentId}/comments?access_token=${pageAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText }),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      console.error("Comment reply error:", res.status, errText);
    }
  } catch (e) {
    console.error("Comment reply failed:", e);
  }
}

// ---- Instagram Comment Handler (public reply + DM handoff) ----

async function handleIgCommentEvent(
  supabase: any, value: any, pageAccessToken: string,
  settings: Record<string, string>, userId: string | null,
  lovableApiKey: string | undefined, igUserId: string | null
) {
  if (settings.ig_comment_auto_reply === "false") return;
  const commentId = value?.id;
  if (!commentId) return;
  // Skip our own page's comments
  if (igUserId && value?.from?.id === igUserId) return;

  const commentText = value?.text || "";
  const isBangla = /[\u0980-\u09FF]/.test(commentText);
  const lang = isBangla ? "Bangla" : "English";

  // Build short public reply with AI (kept tiny)
  let publicReply = isBangla
    ? "ধন্যবাদ! আপনাকে DM করছি 📩"
    : "Thanks! Check your DMs 📩";
  if (lovableApiKey && settings.comment_ai_reply !== "false") {
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": lovableApiKey },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: `Reply to an Instagram comment in ${lang}. Max 6 words, friendly, tell them to check DMs. ${settings.manual_instructions || ""}` },
            { role: "user", content: commentText || "(no text)" },
          ],
          max_tokens: 40,
        }),
      });
      const j = await aiRes.json();
      const c = j.choices?.[0]?.message?.content?.trim();
      if (c) publicReply = c.slice(0, 120);
    } catch (e) { console.error("IG comment AI error:", e); }
  }

  // 1) Public reply on the comment
  try {
    await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies?access_token=${pageAccessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: publicReply }),
    });
  } catch (e) { console.error("IG public reply failed:", e); }

  // 2) Private DM handoff via Private Replies API
  if (settings.ig_comment_dm_handoff !== "false") {
    try {
      const dmText = isBangla
        ? (settings.ig_dm_handoff_text_bn || "হ্যালো! আপনার কমেন্টের জন্য ধন্যবাদ — কীভাবে সাহায্য করতে পারি? 🙂")
        : (settings.ig_dm_handoff_text || "Hi! Thanks for your comment — how can I help? 🙂");
      const res = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { comment_id: commentId },
          message: { text: dmText },
        }),
      });
      if (!res.ok) console.error("IG DM handoff error:", res.status, await res.text());
    } catch (e) { console.error("IG DM handoff failed:", e); }
  }
}


// ---- Page Post Auto-Import Handler ----

async function handlePagePostEvent(
  supabase: any, value: any, userId: string | null, lovableApiKey: string | undefined, pageId: string, settings: Record<string, string>
) {
  if (!userId) return;
  if (settings.auto_import_products === "false") return;

  // Only process posts from the page itself (not visitors)
  const posterId = value.from?.id;
  if (posterId !== pageId) return;

  const postId = value.post_id;
  if (!postId) return;

  // Check if already imported
  const { data: existing } = await supabase
    .from("pending_products")
    .select("id")
    .eq("fb_post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return;

  // Check for image
  const photos = value.photos || [];
  const imageUrl = photos[0] || value.link || null;
  if (!imageUrl) return;

  const caption = value.message || "";

  // Use AI to analyze the post
  let aiData: any = {};
  if (lovableApiKey) {
    try {
      const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableApiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{
            role: "system",
            content: `You are a product analyzer. Given a Facebook page post with an image and caption, extract product details. Return ONLY valid JSON with these fields: name, name_bn (Bangla name), description, description_bn, category, color, price (number, 0 if unknown), material, keywords (array of strings). If caption is in Bangla, prioritize Bangla names. Be accurate.`
          }, {
            role: "user",
            content: [
              { type: "text", text: `Post caption: "${caption}"\nAnalyze this product image and extract details:` },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }],
          max_tokens: 500,
        }),
      });
      const result = await aiRes.json();
      const content = result.choices?.[0]?.message?.content || "";
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("AI product analysis error:", e);
    }
  }

  // Insert pending product
  await supabase.from("pending_products").insert({
    user_id: userId,
    fb_post_id: postId,
    image_url: imageUrl,
    post_caption: caption,
    ai_name: aiData.name || caption.slice(0, 50) || "Unnamed Product",
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

  console.log("Auto-imported pending product from post:", postId);
}

// ---- Messaging Handler ----

async function handleMessagingEvent(
  supabase: any, event: any, pageId: string,
  pageAccessToken: string, lovableApiKey: string | undefined,
  settings: Record<string, string>, userId: string | null,
  platform: "facebook" | "instagram" = "facebook"
) {
  const senderId = event.sender?.id;
  if (!senderId) return;
  if (senderId === pageId) return;

  // ---- Delivery & Read receipts ----
  if (event.delivery?.mids?.length) {
    const ts = new Date(event.delivery.watermark || Date.now()).toISOString();
    await supabase.from("messages").update({ delivered_at: ts }).in("fb_message_id", event.delivery.mids);
    return;
  }
  if (event.read?.watermark) {
    const ts = new Date(event.read.watermark).toISOString();
    await supabase.from("messages")
      .update({ read_at: ts })
      .eq("direction", "outgoing")
      .lte("created_at", ts)
      .is("read_at", null);
    return;
  }

  if (!event.message) return;
  if (event.message.is_echo) return;

  const messageText = event.message.text;
  const attachments = event.message.attachments;
  const fbMessageId = event.message?.mid || null;

  // Get or create conversation (with user_id)
  const conversationId = await getOrCreateConversation(supabase, senderId, pageAccessToken, userId, platform);
  if (!conversationId) return;

  let imageUrl: string | null = null;
  if (attachments) {
    const imageAttachment = attachments.find((a: any) => a.type === "image");
    if (imageAttachment) imageUrl = imageAttachment.payload?.url || null;
  }

  // Save incoming message with DB-level idempotency guard (prevents duplicate replies)
  const { error: incomingInsertError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    fb_message_id: fbMessageId,
    direction: "incoming",
    content: messageText || (imageUrl ? "[Image]" : null),
    image_url: imageUrl,
    user_id: userId,
  });

  if (incomingInsertError) {
    if (fbMessageId && incomingInsertError.code === "23505") {
      console.log("Duplicate incoming message ignored:", fbMessageId);
      return;
    }

    console.error("Failed to save incoming message:", incomingInsertError);
    return;
  }

  await supabase.from("conversations").update({
    last_message: messageText || "[Image]",
    last_message_at: new Date().toISOString(),
  }).eq("id", conversationId);

  // Image analysis toggle: if image and analysis is disabled → route to Image Inbox, no AI cost, push notification.
  if (imageUrl && settings.enable_image_analysis === "false") {
    await supabase.from("conversations")
      .update({ needs_human: true, followup_reason: "Customer sent an image (image analysis is OFF)", updated_at: new Date().toISOString() })
      .eq("id", conversationId);
    if (userId) {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "image_received",
        title: "New image from customer",
        body: "A customer sent an image. Open Image Inbox to reply.",
        link: "#conversations:images",
        metadata: { conversation_id: conversationId },
      });
    }
    return;
  }

  // Check auto-reply rules (user-specific)
  const autoReply = await checkAutoReplyRules(supabase, messageText, userId);
  if (autoReply) {
    await sendFbMessage(pageAccessToken, senderId, autoReply);
    await saveOutgoingMessage(supabase, conversationId, autoReply, null, userId);
    return;
  }

  // Handle picture requests
  const imageRequestHandled = await handleProductImageRequest(
    supabase, conversationId, senderId, pageAccessToken, messageText, userId
  );
  if (imageRequestHandled) return;

  // Check credit balance before AI reply
  if (userId) {
    const { data: creditRow } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    const balance = creditRow?.balance ?? 0;
    if (balance <= 0) {
      const noCreditsMsg = settings.no_credits_message || "দুঃখিত, এই মুহূর্তে আমাদের বট সেবা বন্ধ আছে। অনুগ্রহ করে পরে আবার চেষ্টা করুন।";
      await sendFbMessage(pageAccessToken, senderId, noCreditsMsg);
      await saveOutgoingMessage(supabase, conversationId, noCreditsMsg, null, userId);
      return;
    }
  }

  // AI-powered response
  if (lovableApiKey) {
    try {
      const hasImage = !!imageUrl;
      const replyText = await generateAiReply(
        supabase, lovableApiKey, conversationId, messageText, imageUrl, settings, userId
      );

      // Product suggestion handoff — bot detected an unknown product request
      const suggestMatch = replyText && replyText.match(/SUGGEST_PRODUCT:\s*(.+?)(?:\n|$)/i);
      if (suggestMatch) {
        const requested = suggestMatch[1].trim().slice(0, 200);
        if (requested && userId) {
          const { data: convo } = await supabase.from("conversations")
            .select("customer_name, sender_name").eq("id", conversationId).maybeSingle();
          const { data: existing } = await supabase.from("product_suggestions")
            .select("id, request_count").eq("user_id", userId)
            .ilike("requested_product", requested).maybeSingle();
          if (existing) {
            await supabase.from("product_suggestions")
              .update({ request_count: (existing.request_count || 1) + 1, updated_at: new Date().toISOString() })
              .eq("id", existing.id);
          } else {
            await supabase.from("product_suggestions").insert({
              user_id: userId, conversation_id: conversationId,
              customer_name: (convo as any)?.sender_name || null,
              requested_product: requested,
              message_snippet: (messageText || "").slice(0, 300),
            });
          }
        }
        await supabase.from("conversations")
          .update({ needs_human: true, followup_reason: `Customer asked for: ${requested}`, updated_at: new Date().toISOString() })
          .eq("id", conversationId);
        console.log("Logged product suggestion:", requested);
        return;
      }

      // Human handoff sentinel — bot is unsure, mark conversation and stay silent
      if (replyText && replyText.trim().toUpperCase().includes("NEEDS_HUMAN")) {
        const reason = imageUrl
          ? "Customer sent an image the bot could not identify"
          : `Bot unsure about: "${(messageText || "").slice(0, 200)}"`;
        await supabase.from("conversations")
          .update({ needs_human: true, followup_reason: reason, updated_at: new Date().toISOString() })
          .eq("id", conversationId);
        console.log("Marked conversation for human follow-up:", conversationId);
        return;
      }

      // NOTE: Do NOT proactively send product images. Images are only sent when
      // the customer explicitly asks for a picture (handled by handleProductImageRequest above).

      await sendFbMessage(pageAccessToken, senderId, replyText);
      await saveOutgoingMessage(supabase, conversationId, replyText, null, userId);

      // Deduct credits
      if (userId) {
        const costPerText = Number(settings.credit_cost_text) || 0.003;
        const costPerImage = Number(settings.credit_cost_image) || 0.015;
        const deduction = hasImage ? costPerImage : costPerText;
        await deductCredits(supabase, userId, deduction, hasImage ? "image_reply" : "text_reply");
      }

      if (settings.auto_create_orders !== "false") {
        await detectAndProcessOrder(supabase, lovableApiKey, conversationId, messageText, replyText, userId);
      }
      if (settings.auto_create_complaints !== "false") {
        await detectAndCreateComplaint(supabase, lovableApiKey, conversationId, senderId, pageAccessToken, messageText, replyText, userId);
      }
      if (settings.auto_create_leads !== "false") {
        await extractAndSaveLead(supabase, lovableApiKey, conversationId, userId);
      }
    } catch (aiError) {
      console.error("AI processing error:", aiError);
      const fallback = settings.welcome_message || "ধন্যবাদ! আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।";
      await sendFbMessage(pageAccessToken, senderId, fallback);
    }
  }
}

// ---- Helper Functions ----

async function getOrCreateConversation(
  supabase: any, senderId: string, pageAccessToken: string, userId: string | null,
  channel: "facebook" | "instagram" = "facebook"
): Promise<string | null> {
  let query = supabase.from("conversations").select("id").eq("fb_sender_id", senderId);
  if (userId) query = query.eq("user_id", userId);
  const { data: existingConvo } = await query.maybeSingle();

  // Try to fetch sender name. For Instagram, the IG Graph profile endpoint differs
  // (we get a username via /{igsid}?fields=name,username with the page token).
  let senderName = null;
  try {
    const fields = channel === "instagram" ? "name,username" : "first_name,last_name";
    const profileRes = await fetch(
      `https://graph.facebook.com/v21.0/${senderId}?fields=${fields}&access_token=${pageAccessToken}`
    );
    const profile = await profileRes.json();
    if (channel === "instagram") {
      senderName = profile.name || profile.username || null;
    } else if (profile.first_name || profile.last_name) {
      senderName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    }
    console.log(`[${channel}] profile for`, senderId, ":", JSON.stringify(profile));
  } catch (e) {
    console.error("Profile fetch error:", e);
  }

  if (existingConvo) {
    if (senderName) {
      await supabase.from("conversations").update({ sender_name: senderName, channel }).eq("id", existingConvo.id);
    }
    return existingConvo.id;
  }

  const insertData: any = { fb_sender_id: senderId, sender_name: senderName, channel };
  if (userId) insertData.user_id = userId;

  const { data: newConvo, error } = await supabase
    .from("conversations").insert(insertData).select("id").single();
  if (error) { console.error("Error creating conversation:", error); return null; }
  return newConvo.id;
}

async function checkAutoReplyRules(supabase: any, messageText: string | null, userId: string | null): Promise<string | null> {
  if (!messageText) return null;
  let query = supabase.from("auto_reply_rules").select("*").eq("is_active", true).order("priority", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data: rules } = await query;

  if (!rules) return null;
  const lowerMsg = messageText.toLowerCase();

  for (const rule of rules) {
    const keywords: string[] = rule.trigger_keywords || [];
    const matched = keywords.some((kw: string) => lowerMsg.includes(kw.toLowerCase()));
    if (matched) {
      const isBangla = /[\u0980-\u09FF]/.test(messageText);
      return (isBangla && rule.response_text_bn) ? rule.response_text_bn : rule.response_text;
    }
  }
  return null;
}

async function handleProductImageRequest(
  supabase: any, conversationId: string, senderId: string,
  pageAccessToken: string, messageText: string | null, userId: string | null
): Promise<boolean> {
  if (!messageText || !isImageRequestMessage(messageText)) return false;

  const matchedProduct = await findBestProductForImageRequest(supabase, conversationId, messageText, userId);
  const isBangla = /[\u0980-\u09FF]/.test(messageText);

  if (!matchedProduct?.image_url) {
    const askProductName = isBangla
      ? "যে প্রোডাক্টের ছবি চান, নামটা লিখে দিন — সাথে সাথে ছবি পাঠাচ্ছি।"
      : "Please tell me the product name, and I'll send the picture right away.";
    await sendFbMessage(pageAccessToken, senderId, askProductName);
    await saveOutgoingMessage(supabase, conversationId, askProductName, null, userId);
    return true;
  }

  const productName = matchedProduct.name_bn || matchedProduct.name;
  const variantsArr = (matchedProduct.variants || []) as {color: string; image_url: string}[];
  const hasMultipleColors = variantsArr.filter(v => v?.color).length > 1;
  const caption = hasMultipleColors
    ? `${productName} — ৳${matchedProduct.price}। আর কোন রং দেখবেন?`
    : `${productName} — ৳${matchedProduct.price}।`;

  await sendFbImage(pageAccessToken, senderId, matchedProduct.image_url);
  await sendFbMessage(pageAccessToken, senderId, caption);
  await saveOutgoingMessage(supabase, conversationId, caption, matchedProduct.image_url, userId);
  return true;
}

function isImageRequestMessage(messageText: string): boolean {
  const lower = messageText.toLowerCase();
  return IMAGE_REQUEST_KEYWORDS.some((keyword) => lower.includes(keyword));
}

async function findBestProductForImageRequest(
  supabase: any, conversationId: string, messageText: string, userId: string | null
) {
  let query = supabase
    .from("products")
    .select("name, name_bn, price, image_url, keywords, color, variants")
    .eq("is_active", true);
  if (userId) query = query.eq("user_id", userId);
  const { data: products } = await query;

  if (!products?.length) return null;

  const { data: recentMessages } = await supabase
    .from("messages")
    .select("content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(12);

  const context = [
    messageText,
    ...(recentMessages || []).map((m: any) => m.content || ""),
  ].join(" ").toLowerCase();

  // Detect customer's requested color using alias map
  let requestedColor: string | null = null;
  for (const [canonical, aliases] of Object.entries(COLOR_ALIASES)) {
    if (aliases.some(a => context.includes(a))) {
      requestedColor = canonical;
      break;
    }
  }

  let best: any = null;
  let bestScore = 0;
  let bestVariantImage: string | null = null;

  for (const product of products) {
    const terms = [
      product.name,
      product.name_bn,
      product.color,
      ...((product.keywords || []) as string[]),
    ]
      .filter(Boolean)
      .map((t: string) => t.toLowerCase().trim())
      .filter((t: string) => t.length > 1);

    let score = 0;
    for (const term of terms) {
      if (context.includes(term)) score += term.length >= 4 ? 2 : 1;
    }

    // Check variant colors with normalized matching
    let variantImg: string | null = null;
    const variants = (product.variants || []) as {color: string; image_url: string}[];

    if (requestedColor && variants.length > 0) {
      for (const v of variants) {
        if (normalizeColorName(v.color) === requestedColor) {
          score += 5;
          variantImg = v.image_url;
          break;
        }
      }
    } else {
      for (const v of variants) {
        if (v.color && context.includes(v.color.toLowerCase())) {
          score += 3;
          variantImg = v.image_url;
        }
      }
    }

    if (score > bestScore) {
      best = product;
      bestScore = score;
      bestVariantImage = variantImg;
    }
  }

  if (best) {
    if (bestVariantImage) best = { ...best, image_url: bestVariantImage };
    return best;
  }
  if (products.length === 1) return products[0];
  return null;
}

// Color alias map for common Bangla/English/Banglish color names
const COLOR_ALIASES: Record<string, string[]> = {
  "cream": ["cream", "ক্রিম", "krim", "off white", "অফ হোয়াইট"],
  "pink": ["pink", "পিংক", "গোলাপি", "golapi"],
  "maroon": ["maroon", "মেরুন", "merun"],
  "black": ["black", "কালো", "kalo"],
  "white": ["white", "সাদা", "shada", "sada"],
  "red": ["red", "লাল", "lal"],
  "blue": ["blue", "নীল", "nil"],
  "green": ["green", "সবুজ", "sobuj", "shobuj"],
  "grey": ["grey", "gray", "ধূসর", "গ্রে"],
  "navy": ["navy", "নেভি", "nevy"],
  "beige": ["beige", "বেইজ"],
  "brown": ["brown", "বাদামী", "badami"],
  "purple": ["purple", "বেগুনি", "beguni"],
  "orange": ["orange", "কমলা", "komla"],
  "yellow": ["yellow", "হলুদ", "holud"],
  "magenta": ["magenta", "ম্যাজেন্টা"],
  "peach": ["peach", "পিচ"],
  "coral": ["coral", "কোরাল"],
  "olive": ["olive", "অলিভ"],
  "teal": ["teal", "টিল"],
  "sky blue": ["sky blue", "আকাশী", "akashi"],
  "dusty pink": ["dusty pink", "ডাস্টি পিংক"],
  "wine": ["wine", "ওয়াইন"],
  "rust": ["rust", "রাস্ট"],
};

function normalizeColorName(color: string): string {
  const lower = color.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(COLOR_ALIASES)) {
    if (aliases.some(a => lower.includes(a) || a.includes(lower))) return canonical;
  }
  return lower;
}

function findMentionedProductWithVariant(
  products: any[], aiReply: string, customerMsg: string | null, conversationContext?: string
): { product: any; variantImage: string | null } {
  if (!products?.length) return { product: null, variantImage: null };

  // CRITICAL: Use customer messages (current + history) for color detection, NOT the AI reply
  // AI reply may mention other colors, but customer's words determine which image to send
  const customerText = `${customerMsg || ""} ${conversationContext || ""}`.toLowerCase();
  const aiText = aiReply.toLowerCase();
  const combinedForProduct = `${aiText} ${customerText}`; // for product name matching only

  // Step 1: Detect which color the CUSTOMER is asking about (from their messages only)
  let requestedColor: string | null = null;
  for (const [canonical, aliases] of Object.entries(COLOR_ALIASES)) {
    if (aliases.some(a => customerText.includes(a))) {
      requestedColor = canonical;
      break;
    }
  }

  let best: any = null;
  let bestScore = 0;
  let bestVariantImage: string | null = null;

  for (const p of products) {
    const terms = [
      p.name, p.name_bn, p.color,
      ...((p.keywords || []) as string[]),
    ].filter(Boolean).map((t: string) => t.toLowerCase().trim()).filter((t: string) => t.length > 1);

    let score = 0;
    for (const term of terms) {
      if (combinedForProduct.includes(term)) score += term.length >= 4 ? 3 : 1;
    }
    if (score > 0 && aiText.includes(String(p.price))) score += 2;

    // Check variant colors — match against CUSTOMER's requested color specifically
    let variantImg: string | null = null;
    const variants = (p.variants || []) as {color: string; image_url: string}[];

    if (requestedColor && variants.length > 0) {
      // Find the variant whose color normalizes to the customer's requested color
      for (const v of variants) {
        const variantNorm = normalizeColorName(v.color);
        if (variantNorm === requestedColor) {
          score += 6; // Very strong boost for exact customer-requested color match
          variantImg = v.image_url;
          break; // Take the first exact match
        }
      }
    } else {
      // Fallback: check if any variant color appears in customer text literally
      for (const v of variants) {
        if (v.color && customerText.includes(v.color.toLowerCase())) {
          score += 4;
          variantImg = v.image_url;
        }
      }
    }

    if (score > bestScore) {
      best = p;
      bestScore = score;
      bestVariantImage = variantImg;
    }
  }

  return bestScore >= 2 ? { product: best, variantImage: bestVariantImage } : { product: null, variantImage: null };
}

async function sendFbMessage(pageAccessToken: string, recipientId: string, text: string) {
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
}

async function sendFbImage(pageAccessToken: string, recipientId: string, imageUrl: string) {
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "image",
          payload: { url: imageUrl, is_reusable: true },
        },
      },
    }),
  });
}

async function saveOutgoingMessage(
  supabase: any, conversationId: string, content: string,
  imageUrl: string | null = null, userId: string | null = null
) {
  const insertData: any = {
    conversation_id: conversationId,
    direction: "outgoing",
    content,
    image_url: imageUrl,
  };
  if (userId) insertData.user_id = userId;

  await supabase.from("messages").insert(insertData);
  await supabase.from("conversations").update({
    last_message: content || (imageUrl ? "[Image]" : null),
    last_message_at: new Date().toISOString(),
  }).eq("id", conversationId);
}

function parseMaxSentences(maxReplyLength?: string): number {
  if (!maxReplyLength) return 4;
  const match = maxReplyLength.match(/\d+/);
  if (!match) return 4;
  const parsed = Number.parseInt(match[0], 10);
  if (Number.isNaN(parsed)) return 4;
  return Math.min(Math.max(parsed, 1), 6);
}

function sanitizeReplyText(reply: string, maxReplyLength?: string): string {
  const maxSentences = parseMaxSentences(maxReplyLength);

  const normalized = reply
    .replace(/\[[^\]]*image[^\]]*\]/gi, "")
    .replace(/technical problem/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";

  const segments = normalized
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    const key = segment
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "")
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(segment);
  }

  return unique.slice(0, maxSentences).join(" ").trim();
}

async function generateAiReply(
  supabase: any, apiKey: string, conversationId: string,
  messageText: string | null, imageUrl: string | null,
  settings: Record<string, string>, userId: string | null
): Promise<string> {
  // Fetch FULL conversation history (up to 50 messages) so AI remembers context
  const { data: recentMessages } = await supabase
    .from("messages").select("direction, content, image_url")
    .eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(50);

  let productQuery = supabase
    .from("products").select("name, name_bn, description, description_bn, price, category, keywords, image_url, color, size, material, variants, size_variants")
    .eq("is_active", true);
  if (userId) productQuery = productQuery.eq("user_id", userId);
  const { data: products } = await productQuery;

  // ----- AI Receptionist: load business category + services -----
  let businessCategory: string | null = null;
  let businessInfoObj: any = {};
  let servicesList: any[] = [];
  if (userId) {
    const { data: prof } = await supabase
      .from("profiles").select("business_category, business_info").eq("id", userId).maybeSingle();
    businessCategory = prof?.business_category || null;
    businessInfoObj = prof?.business_info || {};
    if (businessCategory && businessCategory !== "ecommerce") {
      const { data: svcs } = await supabase
        .from("services").select("name, description, price_text, duration_text, service_area")
        .eq("user_id", userId).eq("category", businessCategory).eq("active", true);
      servicesList = svcs || [];
    }
  }

  const leadFieldsByCategory: Record<string, string[]> = {
    ecommerce: ["Customer Name", "Phone Number", "Product Interested In"],
    dental:    ["Patient Name", "Phone Number", "Interested Service", "Preferred Appointment Date"],
    hvac:      ["Customer Name", "Phone Number", "Address", "Service Needed", "Preferred Visit Date"],
    salon:     ["Customer Name", "Phone Number", "Service Interested In", "Appointment Date"],
  };
  const categoryLabel: Record<string, string> = {
    ecommerce: "online store", dental: "dental clinic",
    hvac: "HVAC / home services company", salon: "beauty salon / med spa",
  };
  const receptionistPreamble = businessCategory ? `#############################
# ROLE — AI RECEPTIONIST (HIGHEST PRIORITY)
#############################
You are the AI Receptionist for a ${categoryLabel[businessCategory] || "business"}. Your two jobs:
1) ANSWER questions using ONLY the knowledge base below. If something is not in the knowledge base, say you'll check with the team — NEVER invent prices, hours, services, or policies.
2) CAPTURE a lead by collecting these fields naturally during the conversation: ${leadFieldsByCategory[businessCategory].join(", ")}. Ask one missing field at a time.

${servicesList.length ? `SERVICES WE OFFER:\n${servicesList.map((s: any) => `- ${s.name}${s.price_text ? ` — ${s.price_text}` : ""}${s.duration_text ? ` (${s.duration_text})` : ""}${s.description ? `: ${s.description}` : ""}${s.service_area ? ` | Area: ${s.service_area}` : ""}`).join("\n")}` : ""}
${businessInfoObj.delivery_info ? `\nDELIVERY: ${businessInfoObj.delivery_info}` : ""}
${businessInfoObj.return_policy ? `\nRETURN POLICY: ${businessInfoObj.return_policy}` : ""}
${businessInfoObj.hours ? `\nHOURS: ${businessInfoObj.hours}` : ""}
${businessInfoObj.address ? `\nADDRESS: ${businessInfoObj.address}` : ""}
${businessInfoObj.faqs ? `\nFAQs: ${businessInfoObj.faqs}` : ""}
#############################
` : "";


  // Fetch website knowledge base (if any)
  let websiteKnowledge = "";
  if (userId) {
    const { data: kb } = await supabase
      .from("website_knowledge")
      .select("title, page_url, summary, content")
      .eq("user_id", userId)
      .limit(30);
    if (kb?.length) {
      websiteKnowledge = kb.map((k: any) =>
        `• ${k.title || k.page_url}\n  URL: ${k.page_url}\n  ${(k.summary || k.content || "").slice(0, 400)}`
      ).join("\n\n");
    }
  }

  // Group products by category for the AI
  const productsByCategory: Record<string, any[]> = {};
  products?.forEach((p: any) => {
    const cat = p.category || "Other";
    if (!productsByCategory[cat]) productsByCategory[cat] = [];
    productsByCategory[cat].push(p);
  });

  const productCatalog = Object.entries(productsByCategory).map(([category, items]) => {
    const itemList = items.map((p: any) => {
      const variants = (p.variants || []) as {color: string; image_url: string}[];
      const variantColors = variants.map((v: any) => v.color).filter(Boolean);
      const allColors = [p.color, ...variantColors].filter(Boolean);
      const colorSection = allColors.length
        ? ` | Colors: ${allColors.join(", ")} (each color has its own separate image — send the EXACT color image the customer asks for)`
        : "";
      const sizeVars = (p.size_variants || []) as {size: string; price: number}[];
      const sizeSection = sizeVars.length
        ? ` | Size options: ${sizeVars.map(s => `${s.size}=৳${s.price}`).join(", ")}`
        : "";
      return `  - ${p.name}${p.name_bn ? ` (${p.name_bn})` : ""}: ৳${p.price}${sizeSection}${colorSection}${p.size ? ` | Size: ${p.size}` : ""}${p.material ? ` | Material: ${p.material}` : ""}${p.description ? ` — ${p.description}` : ""}${p.keywords?.length ? ` [${p.keywords.join(", ")}]` : ""}`;
    }).join("\n");
    return `📁 ${category} (${items.length} items):\n${itemList}`;
  }).join("\n\n") || "No products available.";

  // Build category summary for smart questioning
  const categorySummary = Object.entries(productsByCategory).map(([cat, items]) => {
    const allColors = [...new Set(items.flatMap((p: any) => {
      const variantColors = (p.variants || []).map((v: any) => v.color).filter(Boolean);
      return [p.color, ...variantColors].filter(Boolean);
    }))];
    const sizes = [...new Set(items.map((p: any) => p.size).filter(Boolean))];
    const priceRange = items.length > 1
      ? `৳${Math.min(...items.map((p: any) => p.price))} - ৳${Math.max(...items.map((p: any) => p.price))}`
      : `৳${items[0].price}`;
    return `- ${cat}: ${items.length} variants${allColors.length ? `, Colors: ${allColors.join(", ")}` : ""}${sizes.length ? `, Sizes: ${sizes.join(", ")}` : ""}, Price: ${priceRange}`;
  }).join("\n");

  const chatHistory = (recentMessages || []).reverse().map((m: any) => ({
    role: m.direction === "incoming" ? "user" as const : "assistant" as const,
    content: m.image_url && m.direction === "incoming"
      ? [{ type: "text" as const, text: m.content || "Customer sent an image" }, { type: "image_url" as const, image_url: { url: m.image_url } }]
      : m.content || "",
  }));

  const hasImage = !!imageUrl;

  // Build product image references
  const productsWithImages = products?.filter((p: any) => p.image_url) || [];
  const productImageList = productsWithImages
    .map((p: any) => `${p.name}${p.name_bn ? ` (${p.name_bn})` : ""} [${p.category || 'uncategorized'}] — ৳${p.price}`)
    .join("\n") || "";

  // When customer sends an image, include product images so AI can visually compare
  let currentUserMessage: any;
  if (imageUrl) {
    const contentParts: any[] = [];

    // Add instruction text
      const imageAnalysisPrompt = messageText
        ? `Customer said: "${messageText}" and sent an image. Compare it visually with our product images below. If the customer's image matches any product (same type + similar color/design), tell the name and price. If no exact match, suggest the closest similar product from our catalog with its price. Keep reply 1-2 sentences max.`
        : `Customer sent this image. Compare it visually with our product images below. If it matches any product, tell the name and price. If no exact match, suggest the closest similar product from our catalog with its price. Keep reply 1-2 sentences max.`;

    contentParts.push({ type: "text", text: imageAnalysisPrompt });

    // Add customer's image
    contentParts.push({ type: "text", text: "CUSTOMER'S IMAGE:" });
    contentParts.push({ type: "image_url", image_url: { url: imageUrl } });

    // Add product images for visual comparison (limit to 10 to stay within token limits)
    if (productsWithImages.length > 0) {
      contentParts.push({ type: "text", text: "OUR PRODUCT IMAGES (compare customer's image against these):" });
      for (const p of productsWithImages.slice(0, 10)) {
        contentParts.push({
          type: "text",
          text: `Product: ${p.name}${p.name_bn ? ` (${p.name_bn})` : ""} — ৳${p.price}`
        });
        contentParts.push({ type: "image_url", image_url: { url: p.image_url } });
      }
    }

    currentUserMessage = { role: "user", content: contentParts };
  } else {
    currentUserMessage = { role: "user", content: messageText || "" };
  }

  let examplesSection = "";
  if (settings.reply_examples) {
    try {
      const examples = JSON.parse(settings.reply_examples);
      if (examples.length > 0) {
        examplesSection = "\n\nREPLY EXAMPLES (follow this exact style):\n" +
          examples.map((ex: any) => `Customer: "${ex.customer}"\nYou reply: "${ex.reply}"${ex.category ? ` [${ex.category}]` : ""}`).join("\n\n");
      }
    } catch {}
  }

  let neverSaySection = "";
  if (settings.never_say_list) {
    try {
      const items = JSON.parse(settings.never_say_list);
      if (items.length > 0) {
        neverSaySection = "\n\nNEVER DO THESE:\n" + items.map((item: string) => `- ❌ ${item}`).join("\n");
      }
    } catch {}
  }
  if (settings.ai_never_say) {
    neverSaySection += `\n${settings.ai_never_say}`;
  }

  let faqSection = "";
  if (settings.faq_list) {
    try {
      const faqs = JSON.parse(settings.faq_list);
      if (faqs.length > 0) {
        faqSection = "\n\nFAQ KNOWLEDGE BASE (use these for accurate answers):\n" +
          faqs.map((f: any) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
      }
    } catch {}
  }

  // Detect if customer's current message is in English
  const isCurrentMsgEnglish = messageText ? !/[\u0980-\u09FF]/.test(messageText) && /^[a-zA-Z0-9\s.,!?'"@#$%^&*()_+\-=\[\]{};:\\|<>\/~`]+$/.test(messageText.trim()) : false;
  // Also check Banglish (Latin script Bangla like "ki korben", "daam koto")
  const banglishPatterns = /\b(ki|koto|kemon|ache|nai|den|dao|korbo|hobe|lagbe|chai|bhai|vai|apu|apa|dada|didi|niben|diben|dekhao|dekhi|bolun|bolben|pathaen|pathao|order|korte|korben|price|dam|daam|shob|gula|gulo|ta|ti|er|theke)\b/i;
  const isBanglish = messageText ? banglishPatterns.test(messageText) : false;
  // If message has Bangla script OR is Banglish, reply in Bangla
  const shouldReplyBangla = !isCurrentMsgEnglish || isBanglish;

  // ====== LANGUAGE PREFERENCE (user-controlled in Bot Settings) ======
  // Supported: "bn" | "ko" | "en" | "es" | "mix" (default: mix)
  const replyLang = (settings.reply_language || "mix").toLowerCase();
  const inboundCount = (recentMessages || []).filter((m: any) => m.direction === "inbound").length;
  const isFirstInbound = inboundCount <= 1; // current message is included
  const hasKorean = messageText ? /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(messageText) : false;
  const hasBangla = messageText ? /[\u0980-\u09FF]/.test(messageText) : false;
  const hasSpanish = messageText ? /[áéíóúñ¿¡]/i.test(messageText) : false;
  const detectedLang = hasKorean ? "ko" : hasBangla ? "bn" : hasSpanish ? "es" : (isBanglish ? "bn-latin" : (isCurrentMsgEnglish ? "en" : "unknown"));

  let languageDirective = "";
  if (replyLang === "bn") {
    languageDirective = `LANGUAGE RULE — STRICT:\n- ALWAYS reply in Bangla script (বাংলা). Never English, never Banglish, never any other language.\n- Product names may remain in English. Everything else must be Bangla script.`;
  } else if (replyLang === "ko") {
    languageDirective = `LANGUAGE RULE — STRICT:\n- ALWAYS reply in Korean (한국어). Never English, never any other language.\n- Product names may remain in English. Everything else must be Korean.`;
  } else if (replyLang === "en") {
    languageDirective = `LANGUAGE RULE — STRICT:\n- ALWAYS reply in clear, simple English. Never any other language.`;
  } else if (replyLang === "es") {
    languageDirective = `LANGUAGE RULE — STRICT:\n- ALWAYS reply in Spanish (Español). Never any other language.`;
  } else {
    // mix mode: detect & mirror; first message English; ask if unknown
    languageDirective = `LANGUAGE RULE — MIX MODE (STRICT):
- If this is the customer's FIRST message in the conversation, reply in ENGLISH.
- Otherwise, DETECT the customer's language and reply in EXACTLY that language:
  • Bangla script (বাংলা) → reply in Bangla script
  • Korean (한국어) → reply in Korean
  • Spanish → reply in Spanish
  • English → reply in English
  • Banglish (Bangla in Latin letters) → reply in Banglish
- If you CANNOT confidently identify the language, politely ASK the customer which language they prefer (offer: English / বাংলা / 한국어 / Español).
- NEVER switch languages mid-conversation unless the customer switches first.
${isFirstInbound ? "→ This IS the first message: reply in English." : `→ Detected language: ${detectedLang}. Reply in that language.`}`;
  }
  // ====== END LANGUAGE PREFERENCE ======

  // Branch system prompt by business category.
  // Service verticals (dental/hvac/salon) get a clean AI Receptionist prompt
  // with no product catalog, no order/shopkeeper/skincare bias.
  const isServiceVertical = !!(businessCategory && businessCategory !== "ecommerce");

  const personaByCat: Record<string, string> = {
    dental: `You are the polite front-desk receptionist for "${settings.business_name || "the clinic"}". Speak warmly and professionally like a real dental clinic receptionist.`,
    hvac:   `You are the dispatch coordinator for "${settings.business_name || "the company"}". Speak clearly and helpfully like a real HVAC / home-services dispatcher.`,
    salon:  `You are the front-desk concierge for "${settings.business_name || "the salon"}". Speak warmly and politely like a real salon / med-spa front desk.`,
  };

  const kbForVertical = isServiceVertical ? [
    settings.business_address || businessInfoObj.business_address ? `ADDRESS: ${settings.business_address || businessInfoObj.business_address}` : "",
    settings.operating_hours || businessInfoObj.hours ? `HOURS: ${settings.operating_hours || businessInfoObj.hours}` : "",
    businessCategory === "dental" && settings.insurance_accepted ? `INSURANCE ACCEPTED: ${settings.insurance_accepted}` : "",
    businessCategory === "hvac" && settings.service_area_zips ? `SERVICE AREA: ${settings.service_area_zips}` : "",
    settings.emergency_policy ? `EMERGENCY POLICY: ${settings.emergency_policy}` : "",
    settings.cancellation_policy ? `CANCELLATION POLICY: ${settings.cancellation_policy}` : "",
    businessCategory === "salon" && settings.deposit_policy ? `DEPOSIT POLICY: ${settings.deposit_policy}` : "",
    businessCategory === "hvac" && settings.pricing_policy ? `PRICING POLICY: ${settings.pricing_policy}` : "",
  ].filter(Boolean).join("\n") : "";

  const servicesBlock = servicesList.length
    ? `\nSERVICES WE OFFER:\n${servicesList.map((s: any) => `- ${s.name}${s.price_text ? ` — ${s.price_text}` : ""}${s.duration_text ? ` (${s.duration_text})` : ""}${s.description ? `: ${s.description}` : ""}${s.service_area ? ` | Area: ${s.service_area}` : ""}`).join("\n")}`
    : "";

  let systemPrompt: string;

  if (isServiceVertical) {
    const leadFields = (leadFieldsByCategory[businessCategory!] || []).join(", ");
    systemPrompt = `${receptionistPreamble}#############################
# IDENTITY
#############################
${settings.ai_personality || personaByCat[businessCategory!] || "You are the receptionist."}
${settings.business_description ? `About us: ${settings.business_description}` : ""}
Tone: ${settings.reply_tone || "warm, professional, concise."}

#############################
# LANGUAGE
#############################
${languageDirective}

#############################
# REPLY STYLE
#############################
- 1–2 short sentences. Plain text only. No markdown, no bullet lists.
- Answer ONLY what the customer asked. No fluff, no upsell, no flattery.
- Max 1 emoji per reply (use sparingly).
- NEVER invent prices, services, hours, insurance, addresses, or policies. If unknown, say you'll check with the team.
- Never offer or send images. Never mention competitors.
- Never use the words "order", "delivery", "shipping", "return", "product catalog" — this is a service business, not a shop.

#############################
# KNOWLEDGE BASE (the ONLY facts you may use)
#############################
${kbForVertical || "(No business info configured yet — answer general questions and focus on capturing the lead.)"}
${servicesBlock}
${faqSection}
${websiteKnowledge ? `\nADDITIONAL WEBSITE KNOWLEDGE:\n${websiteKnowledge}\n` : ""}

#############################
# YOUR JOB — APPOINTMENT / LEAD CAPTURE
#############################
Your goal every conversation: (1) answer accurately from the knowledge base above, and (2) capture an appointment lead.

Collect these fields naturally, ONE at a time, only the ones still missing: ${leadFields}.
- Never dump all questions at once.
- Once you have every field, summarize and ask the customer to confirm: e.g. "Just to confirm — [Name], [phone], [service] on [date]. Shall I book that?"
- Only mark it confirmed after they reply yes / confirm / ok.
- If the customer asks something outside the knowledge base, say "Let me check with our team and get right back to you." Then continue lead capture.

#############################
# FALLBACK
#############################
- Always reply. Never go silent. If a message is vague, ask a polite 1-line clarification.
- If you truly cannot help even after clarification, output EXACTLY this single token and nothing else:
  NEEDS_HUMAN
${neverSaySection}
${settings.custom_instructions || ""}
${examplesSection}`;
  } else {
    // ---- Ecommerce shopkeeper prompt (preserved) ----
    systemPrompt = `${receptionistPreamble}#############################
# LANGUAGE RULE — HIGHEST PRIORITY — MUST FOLLOW BEFORE ANYTHING ELSE
#############################
${languageDirective}
#############################

${settings.ai_personality || `You are "${settings.bot_name || "LeadPilot"}", the friendly sales assistant for "${settings.business_name || "our shop"}" on Facebook Messenger.`}
${settings.business_description ? `\nBusiness: ${settings.business_description}` : ""}
${settings.reply_tone ? `\nTone: ${settings.reply_tone}` : ""}

#############################
# REPLY STYLE — SIMPLE & DIRECT
#############################
- Answer ONLY what the customer asked. 1-2 short sentences.
- Plain text only. No markdown/bullets. No flattery.
- NEVER offer to send a picture. Only send one if the customer explicitly asks.

${settings.emoji_style ? `Emoji: ${settings.emoji_style}` : "Use max 1 emoji per reply."}

PRODUCT CATALOG (organized by category):
${productCatalog}

CATEGORY SUMMARY:
${categorySummary}

${websiteKnowledge ? `WEBSITE KNOWLEDGE BASE:\n${websiteKnowledge}\n` : ""}

${settings.image_instructions || ""}

${settings.order_instructions || `ORDER COLLECTION:
- Collect: name, phone, full address, product, quantity. Ask one at a time.
- Summarize then confirm. Only confirm after the customer says "ha/yes/confirm".`}
${settings.delivery_info ? `Delivery: ${settings.delivery_info}` : ""}
${settings.payment_methods ? `Payment: ${settings.payment_methods}` : ""}

- ALWAYS REPLY. If unclear, ask a short polite clarification. If you truly can't help, output exactly: NEEDS_HUMAN
- If the customer asks for a SPECIFIC product NOT in the catalog, output exactly: SUGGEST_PRODUCT: <name>
${neverSaySection}
${settings.custom_instructions || ""}
${examplesSection}
${faqSection}`;
  }



  const historyWithoutLast = chatHistory.slice(0, -1);

  const requestBody: any = {
    model: "google/gemini-2.5-flash",
    messages: [{ role: "system", content: systemPrompt }, ...historyWithoutLast, currentUserMessage],
  };

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI Gateway error:", aiResponse.status, errText);
    throw new Error("AI error");
  }

  const aiData = await aiResponse.json();
  const rawReply = aiData.choices?.[0]?.message?.content || "";
  const cleanedReply = sanitizeReplyText(rawReply, settings.max_reply_length);

  // Log AI usage
  const callType = hasImage ? "image" : "text";
  const estimatedCost = hasImage ? 0.003 : 0.0005;
  await logAiUsage(supabase, userId, callType, "google/gemini-2.5-flash", estimatedCost);

  return cleanedReply || settings.welcome_message || "ধন্যবাদ! আপনার মেসেজ পেয়েছি।";
}

async function detectAndProcessOrder(
  supabase: any, apiKey: string, conversationId: string,
  customerMessage: string | null, aiReply: string, userId: string | null
) {
  if (!customerMessage) return;

  // Broader keyword set: covers new orders, modifications, and cancellations
  const orderKeywords = [
    "order", "অর্ডার", "কিনতে", "নিব", "দিন", "চাই", "confirm", "confirmed", "confirmation",
    "buy", "purchase", "book", "ok", "okay", "yes", "হ্যাঁ", "হ্যা", "জি", "ঠিক আছে", "done",
    "কনফার্ম", "নিতে", "লাগবে", "দরকার", "korbo", "nibo", "chai", "lagbe",
    // Modification keywords
    "আরো", "aro", "more", "add", "যোগ", "change", "পরিবর্তন", "update", "বাড়াও", "কমাও",
    "another", "extra", "সাথে", "sathe", "আরেকটা", "arekta",
    // Cancellation keywords
    "cancel", "বাতিল", "batil", "remove", "মুছে", "না চাই", "na chai", "don't want",
    "চাই না", "লাগবে না", "lagbe na", "বাদ", "bad", "রাখবো না", "রাখব না",
  ];
  const lowerMsg = customerMessage.toLowerCase();
  const hasOrderIntent = orderKeywords.some(kw => lowerMsg.includes(kw));

  if (!hasOrderIntent) return;

  try {
    // Fetch conversation history
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("direction, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(40);

    const transcript = (recentMessages || [])
      .map((m: any) => `${m.direction === "incoming" ? "Customer" : "Bot"}: ${m.content || ""}`)
      .join("\n");

    // Fetch products for price lookup
    let productQuery = supabase.from("products").select("name, name_bn, price").eq("is_active", true);
    if (userId) productQuery = productQuery.eq("user_id", userId);
    const { data: products } = await productQuery;
    const productList = (products || []).map((p: any) => `${p.name}${p.name_bn ? ` (${p.name_bn})` : ""}: ৳${p.price}`).join(", ");

    // Check if there's already an existing order for this conversation
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, status, items, total, customer_name, customer_phone, customer_address")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const existingOrderInfo = existingOrder
      ? `\n\nEXISTING ORDER (already in system):\n- Status: ${existingOrder.status}\n- Items: ${JSON.stringify(existingOrder.items)}\n- Total: ৳${existingOrder.total}\n- Name: ${existingOrder.customer_name || "N/A"}\n- Phone: ${existingOrder.customer_phone || "N/A"}\n- Address: ${existingOrder.customer_address || "N/A"}`
      : "\n\nNo existing order for this conversation.";

    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: `You are an order management AI for a Facebook Messenger shop. Read the FULL conversation and determine what action to take.

AVAILABLE ACTIONS:
1. "new_order" — Customer is placing a new order with details
2. "update_order" — Customer wants to ADD more items, CHANGE quantity, or MODIFY an existing order
3. "cancel_order" — Customer wants to CANCEL their order
4. "no_action" — No order-related action needed

PRODUCT PRICES: ${productList}
${existingOrderInfo}

RULES FOR "new_order":
- Customer must have shown intent to buy AND provided details (name, phone, address) somewhere in the conversation
- "ok", "yes", "confirm", "done", "জি", "হ্যাঁ" after bot summary = confirmed order
- "ager details e" or "same details" = reuse details from earlier messages
- Short addresses like "49/4" or "Mirpur 10" are valid
- Phone starting with 01 (11 digits) is valid
- Calculate total = sum of (item price × quantity)

RULES FOR "update_order":
- Only if an existing order already exists
- Customer says things like "আরো 2টা দিন", "add 1 more", "change to 3", "সাথে আরেকটা", "I want 2 more"
- Merge new items with existing items. If same product, update quantity. If new product, add it.
- Keep existing customer details unless customer provides new ones
- Recalculate total after changes

RULES FOR "cancel_order":
- Customer clearly says cancel/বাতিল/don't want/চাই না/লাগবে না
- Only if an existing order exists

RULES FOR "no_action":
- Customer is just asking questions, browsing, or chatting — not ordering
- Details are too incomplete (no items identified)` },
          { role: "user", content: `Full Conversation:\n${transcript}\n\nLatest customer message: "${customerMessage}"\nBot's reply: "${aiReply}"` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "process_order",
            description: "Process order action based on conversation",
            parameters: {
              type: "object",
              properties: {
                action: { type: "string", enum: ["new_order", "update_order", "cancel_order", "no_action"], description: "What action to take" },
                items: { type: "array", description: "FULL updated list of items (for new_order and update_order)", items: { type: "object", properties: { name: { type: "string" }, quantity: { type: "number" }, price: { type: "number" } }, required: ["name", "quantity", "price"] } },
                total: { type: "number", description: "Total price after all changes" },
                customer_name: { type: "string" },
                customer_phone: { type: "string" },
                customer_address: { type: "string" },
                cancel_reason: { type: "string", description: "Why customer is cancelling (if cancel_order)" },
              },
              required: ["action"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "process_order" } },
      }),
    });

    if (!extractResponse.ok) {
      const errText = await extractResponse.text();
      console.error("Order extraction API error:", extractResponse.status, errText);
      return;
    }
    const extractData = await extractResponse.json();

    await logAiUsage(supabase, userId, "order_detection", "google/gemini-2.5-flash-lite", 0.0002);

    const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.log("No tool call in order extraction response");
      return;
    }

    const orderData = JSON.parse(toolCall.function.arguments);
    console.log("Order action:", orderData.action, "Data:", JSON.stringify(orderData));

    // ---- CANCEL ORDER ----
    if (orderData.action === "cancel_order") {
      if (!existingOrder) {
        console.log("Cancel requested but no existing order found");
        return;
      }
      const { error } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          notes: orderData.cancel_reason || "Cancelled by customer via Messenger",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingOrder.id);

      if (error) console.error("Failed to cancel order:", error);
      else console.log("Order cancelled:", existingOrder.id);
      return;
    }

    // ---- NO ACTION ----
    if (orderData.action === "no_action") {
      console.log("No order action needed");
      return;
    }

    // ---- NEW ORDER or UPDATE ORDER ----
    const hasItems = Array.isArray(orderData.items) && orderData.items.length > 0;
    if (!hasItems) {
      console.log("No items found, skipping order action");
      return;
    }

    // Auto-fill prices from product catalog
    if (products?.length) {
      for (const item of orderData.items) {
        if (!item.price || item.price <= 0) {
          const match = products.find((p: any) =>
            p.name.toLowerCase().includes(item.name.toLowerCase()) ||
            item.name.toLowerCase().includes(p.name.toLowerCase()) ||
            (p.name_bn && item.name.includes(p.name_bn))
          );
          if (match) item.price = match.price;
        }
      }
    }

    // Calculate total
    let total = orderData.items.reduce((sum: number, i: any) => sum + (i.price || 0) * (i.quantity || 1), 0);
    if (orderData.total && orderData.total > 0) total = orderData.total;

    // Get customer details — prefer new data, fall back to existing order
    const customerName = orderData.customer_name?.trim() || existingOrder?.customer_name || null;
    const customerPhone = orderData.customer_phone?.trim() || existingOrder?.customer_phone || null;
    const customerAddress = orderData.customer_address?.trim() || existingOrder?.customer_address || null;

    // For new orders, require items + at least 2 customer details
    if (orderData.action === "new_order") {
      const detailCount = [!!customerName, !!customerPhone, !!customerAddress].filter(Boolean).length;
      if (detailCount < 2) {
        console.log("New order details insufficient:", { name: !!customerName, phone: !!customerPhone, address: !!customerAddress });
        return;
      }
    }

    const upsertData: any = {
      conversation_id: conversationId,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      items: orderData.items,
      total: total,
      status: "confirmed",
      updated_at: new Date().toISOString(),
    };
    if (userId) upsertData.user_id = userId;

    if (existingOrder) {
      // UPDATE existing order (modification or re-confirmation)
      const { error } = await supabase
        .from("orders")
        .update(upsertData)
        .eq("id", existingOrder.id);

      if (error) {
        console.error("Failed to update order:", error);
        return;
      }
      console.log(`Order ${orderData.action === "update_order" ? "updated" : "confirmed"}:`, existingOrder.id, "Items:", JSON.stringify(orderData.items), "Total:", total);
    } else {
      // INSERT new order
      const { error } = await supabase.from("orders").insert(upsertData);
      if (error) {
        console.error("Failed to create order:", error);
        return;
      }
      console.log("New order created. Items:", JSON.stringify(orderData.items), "Total:", total);
    }
  } catch (e) {
    console.error("Order processing error:", e);
  }
}

async function logAiUsage(
  supabase: any, userId: string | null, callType: string, model: string, estimatedCost: number
) {
  if (!userId) return;
  try {
    await supabase.from("ai_usage").insert({
      user_id: userId,
      call_type: callType,
      model,
      estimated_cost: estimatedCost,
    });
  } catch (e) {
    console.error("Failed to log AI usage:", e);
  }
}

async function deductCredits(
  supabase: any, userId: string, amount: number, type: string
) {
  try {
    const { data: creditRow, error: selectErr } = await supabase
      .from("user_credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (selectErr) { console.error("Credit select error:", selectErr); return; }
    if (!creditRow) { console.error("No credit row found for user:", userId); return; }

    const newBalance = Math.max(0, Number(creditRow.balance) - amount);
    const { error: updateErr } = await supabase
      .from("user_credits")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateErr) { console.error("Credit update error:", updateErr); return; }
    console.log(`Credits deducted: ${amount} for ${type}. Balance: ${creditRow.balance} -> ${newBalance}`);

    // Log as negative transaction
    const { error: insertErr } = await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: -amount,
      type,
      description: type === "image_reply" ? "AI image analysis" : "AI text reply",
    });
    if (insertErr) console.error("Credit transaction insert error:", insertErr);
  } catch (e) {
    console.error("Failed to deduct credits:", e);
  }
}

async function detectAndCreateComplaint(
  supabase: any, apiKey: string, conversationId: string,
  senderId: string, pageAccessToken: string,
  customerMessage: string | null, aiReply: string, userId: string | null
) {
  if (!customerMessage) return;

  const complaintKeywords = [
    "complaint", "complain", "problem", "issue", "broken", "damaged", "wrong", "bad", "terrible", "worst",
    "অভিযোগ", "সমস্যা", "নষ্ট", "ভাঙ্গা", "খারাপ", "ক্ষতি", "ভুল", "পণ্য ভুল", "ডেমেজ",
    "সমস্যা হচ্ছে", "কাজ করে না", "ফেরত", "return", "refund", "exchange",
    "somossa", "bhangga", "nossto", "kharap", "vul", "damage"
  ];
  const lowerMsg = customerMessage.toLowerCase();
  const hasComplaintIntent = complaintKeywords.some(kw => lowerMsg.includes(kw));

  if (!hasComplaintIntent) return;

  try {
    const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "Extract complaint details. If customer has a genuine complaint, extract info. Return is_complaint=false if just asking a question." },
          { role: "user", content: `Customer: ${customerMessage}\nBot reply: ${aiReply}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_complaint",
            description: "Create a complaint record",
            parameters: {
              type: "object",
              properties: {
                is_complaint: { type: "boolean" },
                complaint_text: { type: "string", description: "Summary of what went wrong" },
                customer_name: { type: "string" },
                customer_phone: { type: "string" },
              },
              required: ["is_complaint"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_complaint" } },
      }),
    });

    if (!extractResponse.ok) return;
    const extractData = await extractResponse.json();
    await logAiUsage(supabase, userId, "complaint_detection", "google/gemini-2.5-flash-lite", 0.0002);

    const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return;

    const data = JSON.parse(toolCall.function.arguments);
    if (!data.is_complaint) return;

    // If no phone number yet, ask for it
    if (!data.customer_phone) {
      const askPhoneMsg = "আপনার অভিযোগ আমরা নোট করেছি। অনুগ্রহ করে আপনার ফোন নম্বর দিন, আমরা আপনাকে কল দিবো। 📞";
      await sendFbMessage(pageAccessToken, senderId, askPhoneMsg);
      await saveOutgoingMessage(supabase, conversationId, askPhoneMsg, null, userId);
    } else {
      const confirmMsg = "আপনার অভিযোগ রেকর্ড করা হয়েছে। আমরা আপনাকে কল দিবো। ধন্যবাদ। 🙏";
      await sendFbMessage(pageAccessToken, senderId, confirmMsg);
      await saveOutgoingMessage(supabase, conversationId, confirmMsg, null, userId);
    }

    // Save complaint
    const insertData: any = {
      conversation_id: conversationId,
      customer_name: data.customer_name || null,
      customer_phone: data.customer_phone || null,
      complaint_text: data.complaint_text || customerMessage,
      status: "pending",
    };
    if (userId) insertData.user_id = userId;

    await supabase.from("complaints").insert(insertData);
    console.log("Complaint created for conversation:", conversationId);
  } catch (e) {
    console.error("Complaint detection error:", e);
  }
}

// ---- AI Receptionist: lead extraction ----
async function extractAndSaveLead(supabase: any, apiKey: string, conversationId: string, userId: string | null) {
  if (!userId || !apiKey) return;
  try {
    const { data: prof } = await supabase
      .from("profiles").select("business_category").eq("id", userId).maybeSingle();
    const category = prof?.business_category;
    if (!category) return;

    const { data: msgs } = await supabase
      .from("messages").select("direction, content")
      .eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(50);
    if (!msgs?.length) return;

    const transcript = msgs.map((m: any) => `${m.direction === "incoming" ? "Customer" : "Bot"}: ${m.content || ""}`).join("\n");

    const fields = category === "ecommerce"
      ? ["name", "phone", "service_or_product"]
      : category === "hvac"
      ? ["name", "phone", "address", "service_or_product", "preferred_date"]
      : ["name", "phone", "service_or_product", "preferred_date"];

    const sysPrompt = `Extract lead information from this Facebook Messenger conversation. Return ONLY a JSON object with these fields (null if not stated): ${fields.join(", ")}. Use null for missing values. Do not invent data.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: transcript.slice(-4000) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { return; }

    // Require at least name OR phone
    if (!parsed.name && !parsed.phone) return;

    // Upsert: one lead per conversation
    const { data: existing } = await supabase
      .from("leads").select("id").eq("conversation_id", conversationId).maybeSingle();

    const payload: any = {
      user_id: userId,
      category,
      conversation_id: conversationId,
      source: "facebook",
      name: parsed.name || null,
      phone: parsed.phone || null,
      address: parsed.address || null,
      service_or_product: parsed.service_or_product || null,
      preferred_date: parsed.preferred_date || null,
    };

    if (existing) {
      await supabase.from("leads").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("leads").insert(payload);
    }
    console.log("Lead saved for conversation:", conversationId);
  } catch (e) {
    console.error("Lead extraction error:", e);
  }
}

// ---- Keyword-based Comment Triggers (ManyChat-style) ----
async function handleCommentTriggers(
  supabase: any, value: any, pageAccessToken: string, userId: string | null, fbPageId: string
) {
  if (!userId) return;
  const commentId = value.comment_id;
  const commentText = (value.message || "").toLowerCase().trim();
  const commenterId = value.from?.id;
  const commenterName = value.from?.name || null;
  if (!commentId || !commentText || !commenterId) return;
  // Skip comments from the page itself
  if (commenterId === fbPageId || commenterId === value.post_id?.split("_")[0]) return;

  // Idempotency: skip if already logged
  const { data: existingLog } = await supabase
    .from("comment_trigger_logs").select("id").eq("fb_comment_id", commentId).maybeSingle();
  if (existingLog) return;

  // Load active triggers for this user (and page if set)
  const { data: triggers } = await supabase
    .from("comment_triggers")
    .select("*")
    .eq("user_id", userId)
    .eq("is_enabled", true)
    .order("priority", { ascending: false });

  if (!triggers?.length) return;

  for (const trigger of triggers) {
    if (trigger.fb_page_id && trigger.fb_page_id !== fbPageId) continue;
    const matched = matchTrigger(commentText, trigger);
    if (!matched) continue;

    // Daily limit check
    const since = new Date(); since.setHours(0,0,0,0);
    const { count: todayCount } = await supabase
      .from("comment_trigger_logs")
      .select("*", { count: "exact", head: true })
      .eq("trigger_id", trigger.id)
      .gte("created_at", since.toISOString());
    if ((todayCount || 0) >= trigger.daily_limit) {
      await supabase.from("comment_trigger_logs").insert({
        user_id: userId, trigger_id: trigger.id, fb_comment_id: commentId, fb_post_id: value.post_id,
        commenter_id: commenterId, commenter_name: commenterName, comment_text: commentText,
        matched_keyword: matched, dm_status: "failed", error: "Daily limit reached",
      });
      return;
    }

    // Pre-insert log row to claim idempotency
    const { error: insErr } = await supabase.from("comment_trigger_logs").insert({
      user_id: userId, trigger_id: trigger.id, fb_comment_id: commentId, fb_post_id: value.post_id,
      commenter_id: commenterId, commenter_name: commenterName, comment_text: commentText,
      matched_keyword: matched, dm_status: "pending",
    });
    if (insErr?.code === "23505") return; // race-condition guard

    let dmStatus = "sent"; let dmError: string | null = null;
    try {
      // Public reply (optional)
      if (trigger.public_reply) {
        await fetch(`https://graph.facebook.com/v21.0/${commentId}/comments?access_token=${pageAccessToken}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trigger.public_reply }),
        }).catch(() => {});
      }
      // Private DM via Messenger Private Replies API
      const dmPayload: any = { recipient: { comment_id: commentId } };
      if (trigger.dm_image_url) {
        dmPayload.message = { attachment: { type: "image", payload: { url: trigger.dm_image_url, is_reusable: true } } };
      } else {
        dmPayload.message = { text: trigger.dm_message };
      }
      const fbResp = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dmPayload),
      });
      const fbJson = await fbResp.json();
      if (!fbResp.ok) {
        dmStatus = "failed";
        dmError = fbJson.error?.message || `FB ${fbResp.status}`;
      } else if (trigger.dm_image_url && trigger.dm_message) {
        // Send text as a follow-up (if both image and text supplied)
        await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${pageAccessToken}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: trigger.dm_message } }),
        }).catch(() => {});
      }
    } catch (e: any) {
      dmStatus = "failed"; dmError = e?.message || String(e);
    }

    await supabase.from("comment_trigger_logs").update({
      dm_status: dmStatus, dm_sent_at: new Date().toISOString(), error: dmError,
    }).eq("fb_comment_id", commentId);

    if (dmStatus === "sent") {
      await supabase.from("comment_triggers").update({
        sent_count: trigger.sent_count + 1, last_sent_at: new Date().toISOString(),
      }).eq("id", trigger.id);
    }
    return; // only first matching trigger fires
  }
}

function matchTrigger(text: string, trigger: any): string | null {
  for (const kw of (trigger.keywords || [])) {
    const k = String(kw).toLowerCase().trim();
    if (!k) continue;
    if (trigger.match_type === "exact" && text === k) return k;
    if (trigger.match_type === "starts_with" && text.startsWith(k)) return k;
    if ((trigger.match_type === "contains" || !trigger.match_type) && text.includes(k)) return k;
  }
  return null;
}
