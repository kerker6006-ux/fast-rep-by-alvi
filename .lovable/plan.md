# Self-Learning AI Training + Chat-Level Corrections

Add two new training capabilities, both scoped per-user (existing RLS already isolates each user's data — no DB users get mixed).

## 1. Auto-Learn from Real Conversations

A scheduled / on-demand analyzer that reads the user's own past messages, finds patterns + bot mistakes, and proposes settings updates the user must confirm before they apply.

**New edge function:** `ai-auto-learn`
- Pulls last N (default 100) messages from `conversations` + `messages` for the calling user only (scoped by `user_id`).
- Sends them to Gemini with a prompt that extracts:
  - Recurring customer question patterns → suggested FAQ additions
  - Bot replies that got negative follow-ups ("না", "wrong", "you didn't understand", repeat questions) → suggested fixes
  - New product/keyword mentions not yet in catalog → suggested auto-reply rules
  - Tone/length issues
- Returns a structured `suggestions[]` array (type, before, after, reason). Nothing is saved yet.

**New table:** `training_suggestions`
- Columns: id, user_id, kind (faq | rule | personality | example | never_say), payload (jsonb), reason, status (pending | applied | rejected), created_at.
- RLS: user can only see/modify their own rows. GRANTs for authenticated + service_role.

**New UI in AI Training page:** "Auto-Learn" tab
- Button: "Analyze my last 100 conversations"
- Shows each suggestion as a card with Before / After / Why
- Per-card Approve / Reject buttons
- Approve → merges into `bot_settings` (FAQ list append, never_say append, personality patch, etc.) and marks suggestion `applied`
- Reject → marks `rejected`
- Fully translated (en/bn/ko/es)

## 2. Per-Chat Bot Correction

In the Chats view, let the user select an assistant message and tell the bot how it should have replied. This becomes a training example.

**Changes to `ConversationsView.tsx`:**
- On each outgoing (bot) message: small "Train" / pencil icon
- Click opens a dialog: shows the original customer message + bot reply, with a textarea "How should the bot have replied?" and optional "Why was this wrong?"
- Submit → inserts into `training_suggestions` as kind=`example` with payload `{customer, wrong_reply, correct_reply, reason}`, status=`pending`
- User then approves it in the Auto-Learn tab (same approval flow), which appends to `bot_settings.reply_examples`

**Optional fast path:** an "Apply immediately" checkbox in the dialog that skips the suggestion queue and writes directly to `reply_examples` — still per-user, still RLS-scoped.

## 3. Data Isolation (confirmation, no new work)

Already enforced — `bot_settings`, `conversations`, `messages`, `training_suggestions` all carry `user_id` with RLS `auth.uid() = user_id`. The new function uses the caller's JWT and never reads cross-user. No shared storage between accounts.

## Files

- New: `supabase/functions/ai-auto-learn/index.ts`
- New migration: `training_suggestions` table + RLS + GRANTs
- New: `src/components/AutoLearnPanel.tsx` (suggestions list + approve/reject)
- New: `src/components/TrainBotDialog.tsx` (per-message correction dialog)
- Edit: `src/components/AiTraining.tsx` — add "Auto-Learn" tab
- Edit: `src/components/ConversationsView.tsx` — add Train button on bot messages
- Edit: `src/i18n/locales/{en,bn,ko,es}.json` — new keys

## Out of scope
- No automatic background cron — user clicks "Analyze" (cheaper, predictable). Can add cron later if requested.
- No model retraining; we update bot settings/examples that the existing reply pipeline already reads.