## Goal

Inside the AI Training Wizard, before any chat starts, automatically read past Messenger conversations, learn from how customers ask and how the owner replies, pre-fill draft bot settings, and then auto-open the wizard chat with informed, specific questions instead of generic ones.

## What changes for the user

1. Open AI Training → AI Wizard tab.
2. Wizard shows an "Analyzing your past conversations…" screen with progress (messages scanned, FAQs detected, tone learned).
3. When analysis finishes, the wizard auto-opens chat and starts with concrete openers like: *"I read 173 past chats. Customers ask about delivery 22×, you usually reply '3–5 days, flat $5'. Should I lock that in? Anything to change?"*
4. User answers; each answer is merged into draft settings live, and at the end one click saves everything.
5. Manual "Auto Learn" tab keeps working as a power-user surface (re-run, approve/reject suggestions), but is no longer the primary entry point.

## What we build

### 1. New edge function `wizard-auto-analyze`
Server-side, reuses Lovable AI Gateway + Gemini.
- Pulls last N messages (default 200, configurable) from `messages` for the active `fb_page_id`, grouped by conversation, ordered oldest→newest.
- Pulls existing `bot_settings`, `products` / `services` (for context), and `auto_reply_rules` so we don't re-suggest dupes.
- Sends to Gemini with a structured-output schema that returns:
  - `tone_summary` (1–2 sentences capturing the owner's reply voice)
  - `top_questions[]` (customer question + frequency + owner's typical reply, max 8)
  - `draft_settings` (welcome_message, out_of_stock_message, reply_tone, ai_personality, business_description, plus category-specific fields)
  - `draft_faqs[]` (q/a pairs ready to merge into `faq_list`)
  - `never_say[]` (phrases the owner never uses but generic AI might)
  - `wizard_openers[]` (3–5 personalized opening questions for the chat to ask, each tied to a `draft_settings` key or FAQ so the answer can patch it)
  - `stats` (messages_scanned, conversations_scanned, languages_detected)
- Caches result in a new `wizard_analysis` row keyed by `fb_page_id` so re-opens are instant; "Re-analyze" button forces a refresh.

### 2. New table `wizard_analysis`
Columns: `id`, `user_id`, `fb_page_id` (unique), `analysis` jsonb, `messages_scanned` int, `created_at`, `updated_at`. Standard GRANTs + RLS scoped to page access (using existing `user_has_page_access`).

### 3. Wizard UI changes inside `AiTraining.tsx`
- Replace today's "pick language → empty chat" first screen with a 3-phase flow:
  - **Phase A — Pre-flight:** show language picker (kept). Continue → kicks off analysis.
  - **Phase B — Analyzing:** card with animated steps ("Reading 173 conversations", "Learning your tone", "Drafting settings"), driven by the edge function's progress. Cancel button → falls back to today's generic chat.
  - **Phase C — Chat (auto-open):** as soon as analysis completes, the chat opens automatically. The first assistant message is composed from the analysis: tone summary + the first `wizard_opener`. Subsequent `wizard_openers` are queued and asked one at a time after each user reply.
- Each user answer is sent to the existing `ai-training-chat` function with an extra `analysis_context` field so the model knows the analysis and can keep questions specific.
- A new "Pre-filled drafts" panel above the chat shows the draft settings the analysis produced, with inline edit and per-row "Keep/Discard". These are saved into local `settings` state but only persisted on **Save All** (same flow as today) so nothing is changed in the bot until the user confirms.

### 4. `AutoLearnPanel.tsx` (existing)
- Stays as a secondary tab labeled "Suggestions inbox". Add a small banner: *"The AI Wizard now auto-analyzes — open it for guided setup."* No logic changes.

### 5. Edge function `ai-training-chat`
- Accept new optional `analysis_context` payload. When present, prepend it to the system prompt so the model asks tone/question-specific follow-ups instead of generic ones, and never re-asks something the analysis already filled.

## Technical notes

- Reuse existing `mergeGeneratedSettings` / `buildSettingsMap` from `src/lib/ai-training-settings.ts` for merging draft settings.
- Reuse `bot_settings` `(fb_page_id, setting_key)` unique index for upserts.
- Auto-analysis runs only when there are ≥ 20 messages on the page; otherwise wizard falls back to today's generic opener with a note: *"Not enough chat history yet — answer a few questions and I'll learn as we go."*
- Language: detected language is offered as the default in the language picker, but the user can still override.
- Cost: one Gemini 2.5 Flash call per analysis (cached). Re-analyze is a manual button.
- No changes to FB sync, webhook, or bot reply pipeline.

## Files touched

- New: `supabase/functions/wizard-auto-analyze/index.ts`
- New migration: `wizard_analysis` table + GRANTs + RLS
- Edit: `src/components/AiTraining.tsx` (new phases, analysis fetch, drafts panel, auto-open chat)
- Edit: `supabase/functions/ai-training-chat/index.ts` (accept `analysis_context`)
- Edit: `src/components/AutoLearnPanel.tsx` (banner only)
