import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANG: Record<string, string> = {
  en: "English",
  bn: "Bangla (বাংলা)",
  es: "Spanish (Español)",
  ko: "Korean (한국어)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user_id = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const fb_page_id: string | undefined = body.fb_page_id;
    const language: string = body.language || "en";
    const force: boolean = !!body.force;
    const category: string = body.category || "ecommerce";

    if (!fb_page_id) {
      return new Response(JSON.stringify({ error: "fb_page_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return cached analysis if available and not forced
    if (!force) {
      const { data: cached } = await supabase
        .from("wizard_analysis")
        .select("analysis, messages_scanned, conversations_scanned, updated_at")
        .eq("fb_page_id", fb_page_id)
        .maybeSingle();
      if (cached?.analysis && Object.keys(cached.analysis).length > 0) {
        return new Response(JSON.stringify({
          cached: true,
          analysis: cached.analysis,
          messages_scanned: cached.messages_scanned,
          conversations_scanned: cached.conversations_scanned,
          updated_at: cached.updated_at,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Pull recent conversations for this page (RLS scoped)
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, sender_name")
      .eq("fb_page_id", fb_page_id)
      .order("last_message_at", { ascending: false })
      .limit(50);
    const convIds = (convs ?? []).map((c: any) => c.id);

    let msgs: any[] = [];
    if (convIds.length) {
      const { data: m } = await supabase
        .from("messages")
        .select("conversation_id, direction, content, created_at")
        .in("conversation_id", convIds)
        .order("created_at", { ascending: true })
        .limit(300);
      msgs = m ?? [];
    }

    if (msgs.length < 5) {
      const empty = {
        insufficient_data: true,
        stats: { messages_scanned: msgs.length, conversations_scanned: convIds.length },
        tone_summary: "",
        top_questions: [],
        draft_settings: {},
        draft_faqs: [],
        never_say: [],
        wizard_openers: [],
      };
      await supabase.from("wizard_analysis").upsert({
        user_id, fb_page_id, analysis: empty,
        messages_scanned: msgs.length, conversations_scanned: convIds.length,
      } as any, { onConflict: "fb_page_id" } as any);
      return new Response(JSON.stringify({ cached: false, analysis: empty, messages_scanned: msgs.length, conversations_scanned: convIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transcript = msgs
      .map((m: any) => `[${m.direction === "outgoing" ? "OWNER/BOT" : "CUSTOMER"}] ${(m.content ?? "").toString().slice(0, 500)}`)
      .join("\n")
      .slice(0, 40000);

    // Pull existing bot settings + auto-reply rules so we don't suggest dupes
    const { data: settingsRows } = await supabase
      .from("bot_settings").select("setting_key, setting_value")
      .eq("fb_page_id", fb_page_id);
    const settings: Record<string, string> = {};
    for (const r of settingsRows ?? []) settings[r.setting_key] = r.setting_value;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const langName = LANG[language] || "English";

    const goalByCat: Record<string, string> = {
      ecommerce: "close sales (pitch, send images, capture name/phone/address/quantity, confirm orders)",
      service: "book appointments (qualify, capture name/phone/service/preferred date)",
      content_creator: "enroll students (pitch the right course, capture name + email/phone + course)",
    };

    const system = `You are analyzing real Facebook Messenger conversations between a business owner and their customers, so a new AI bot can take over the inbox with the SAME voice and answers.

Business category: ${category}. Bot's mission once live: ${goalByCat[category] || goalByCat.ecommerce}.

Reply ONLY in ${langName} for all human-readable strings (tone_summary, wizard_openers, draft_settings text, FAQ q/a). Keep technical keys in English.

EXISTING bot_settings already configured (do NOT propose duplicates, only refinements):
${JSON.stringify(settings).slice(0, 4000)}

You will receive a chat transcript ordered oldest→newest. Tags: [CUSTOMER] = inbound from a real customer, [OWNER/BOT] = outbound (owner or previous bot reply).

Produce a single JSON object with these fields exactly:
{
  "stats": { "owner_replies": number, "customer_messages": number, "languages_detected": [string] },
  "tone_summary": "1-2 sentence description of how the OWNER actually talks (length, formality, emoji, signature phrases). Concrete, in ${langName}.",
  "top_questions": [{"customer_q":"...","owner_typical_reply":"...","frequency": number}],  // max 8
  "draft_settings": {
    // category-aware. Only fill keys you have real evidence for.
    "welcome_message": "...",
    "out_of_stock_message": "...",
    "reply_tone": "...",
    "ai_personality": "Direct instructions to the bot. Mirror the owner's actual voice from the transcript. Cover what to ALWAYS do, what to NEVER do, and how to push for the goal.",
    "business_description": "..."
    // plus optional category-specific keys ONLY if evidenced: delivery_info, payment_methods, return_policy (ecommerce); operating_hours, business_address, pricing_policy, cancellation_policy (service); course_lineup, enrollment_info, refund_policy, support_channel (content_creator)
  },
  "draft_faqs": [{"q":"...","a":"..."}],  // max 8, derived from top_questions, in ${langName}
  "never_say": ["phrase that generic AI might say but owner never does"],  // max 5
  "wizard_openers": [
    // 3-5 concrete, personalized questions to ask the owner in the training chat.
    // Each opener must reference a real insight from the transcript ("I saw 12 customers asked X, you usually reply Y — should I lock that in?").
    // Each opener is tied to a settings key the answer will patch.
    {"question":"...","patches":"welcome_message|out_of_stock_message|ai_personality|..."}
  ]
}

Strict rules:
- ALL strings in ${langName}. No mixing languages inside one string.
- Do not invent facts not in the transcript. If unsure, leave the field out.
- Keep tone_summary, draft_settings text, FAQ answers SHORT — match the owner's actual reply length.
- Output ONLY the JSON object, no commentary.`;

    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: transcript },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests, please wait." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await aiRes.text();
      console.error("wizard-auto-analyze AI error", aiRes.status, t);
      throw new Error(`AI error ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    let analysis: any = {};
    try { analysis = JSON.parse(raw); } catch { analysis = {}; }
    if (typeof analysis !== "object" || analysis === null) analysis = {};

    // Ensure shape
    analysis.stats = analysis.stats || {};
    analysis.stats.messages_scanned = msgs.length;
    analysis.stats.conversations_scanned = convIds.length;
    analysis.draft_settings = analysis.draft_settings || {};
    analysis.draft_faqs = Array.isArray(analysis.draft_faqs) ? analysis.draft_faqs : [];
    analysis.top_questions = Array.isArray(analysis.top_questions) ? analysis.top_questions : [];
    analysis.never_say = Array.isArray(analysis.never_say) ? analysis.never_say : [];
    analysis.wizard_openers = Array.isArray(analysis.wizard_openers) ? analysis.wizard_openers : [];

    // Drop draft_settings keys that are already populated (don't overwrite owner's edits)
    for (const k of Object.keys(analysis.draft_settings)) {
      const cur = settings[k];
      if (cur && String(cur).trim()) delete analysis.draft_settings[k];
    }

    // Cache
    await supabase.from("wizard_analysis").upsert({
      user_id,
      fb_page_id,
      analysis,
      messages_scanned: msgs.length,
      conversations_scanned: convIds.length,
    } as any, { onConflict: "fb_page_id" } as any);

    // Log usage (best-effort)
    try {
      await supabase.from("ai_usage").insert({
        user_id, call_type: "training", model: "gemini-2.5-flash", estimated_cost: 0.003,
      });
    } catch { /* ignore */ }

    return new Response(JSON.stringify({
      cached: false,
      analysis,
      messages_scanned: msgs.length,
      conversations_scanned: convIds.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("wizard-auto-analyze error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
