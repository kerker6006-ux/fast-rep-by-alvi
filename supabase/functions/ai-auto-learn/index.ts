import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { limit = 100, language = "en" } = await req.json().catch(() => ({}));

    // Fetch user's recent messages (RLS scoped)
    const { data: convs } = await supabase
      .from("conversations").select("id, sender_name").eq("user_id", user_id)
      .order("last_message_at", { ascending: false }).limit(50);
    const convIds = (convs ?? []).map((c: any) => c.id);
    if (!convIds.length) {
      return new Response(JSON.stringify({ suggestions: [], analyzed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: msgs } = await supabase
      .from("messages").select("conversation_id, direction, content, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: true }).limit(limit);

    const transcript = (msgs ?? [])
      .map((m: any) => `[${m.direction === "outgoing" ? "BOT" : "CUSTOMER"}] ${m.content ?? ""}`)
      .join("\n");

    // Pull current settings to avoid duplicate suggestions
    const { data: settingsRows } = await supabase
      .from("bot_settings").select("setting_key, setting_value").eq("user_id", user_id);
    const settings: Record<string, string> = {};
    for (const r of settingsRows ?? []) settings[r.setting_key] = r.setting_value;

    const LANG: Record<string, string> = { en: "English", bn: "Bangla", es: "Spanish", ko: "Korean" };
    const langName = LANG[language] || "English";

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "AQ.Ab8RN6JPAkC-US2oy7vl28rRCTz9aes6EjHbOPN0hR-vsGAFSg";
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const system = `You analyze a Facebook Messenger shopkeeper bot's recent conversations and propose improvements.
Reply ONLY in ${langName}.

Existing FAQ: ${settings.faq_list || "(empty)"}
Existing never-say list: ${settings.never_say_list || "(empty)"}
Existing personality: ${settings.ai_personality || "(empty)"}

Analyze the transcript and detect:
1. Recurring customer questions not covered by FAQ -> kind="faq"
2. Bot replies that confused customers, got "না"/"wrong"/repeated questions -> kind="example" with the corrected reply
3. Tone/personality issues -> kind="personality"
4. Things the bot said that it should never say -> kind="never_say"
5. Common keyword triggers worth auto-replying to -> kind="rule"

Return ONLY a JSON object: {"suggestions":[{"kind":"faq|example|personality|never_say|rule","payload":{...},"reason":"why"}]}
- faq payload: {q, a}
- example payload: {customer, wrong_reply, correct_reply}
- personality payload: {addition}
- never_say payload: {phrase}
- rule payload: {keyword, response}

Limit to the 8 most valuable suggestions. Skip anything already present.`;

    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { "x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: transcript.slice(0, 30000) || "(no messages)" },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error ${aiRes.status}`);
    }
    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const suggestions: any[] = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    // Insert into training_suggestions
    const rows = suggestions
      .filter((s) => s && typeof s.kind === "string" && s.payload)
      .map((s) => ({
        user_id,
        kind: s.kind,
        payload: s.payload,
        reason: s.reason ?? null,
        status: "pending",
        source: "auto",
      }));

    if (rows.length) {
      const { error: insErr } = await supabase.from("training_suggestions").insert(rows);
      if (insErr) console.error("insert error", insErr);
    }

    return new Response(JSON.stringify({ suggestions: rows, analyzed: msgs?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-learn error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
