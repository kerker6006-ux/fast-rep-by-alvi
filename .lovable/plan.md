# Smarter AI Training: skip-known, persistent chat, live summary

Make the AI Training wizard feel like a real assistant: it reads what you've already configured, skips those questions, remembers the whole conversation across reloads, and shows a live "What I know about your business" panel that updates as the chat progresses.

## 1. Skip what's already configured

In `supabase/functions/ai-training-chat/index.ts`:

- Build a `knownFields` / `missingFields` list from the incoming `settings` + `category`, using the same per-niche field list the UI uses (business_name, operating_hours, address, insurance, emergency_policy, cancellation_policy, deposit_policy, service_area_zips, pricing_policy, delivery_info, payment_methods, return_policy, faq_list, never_say_list, reply_tone, welcome_message…).
- Inject both into the system prompt with strict rules:
  - "These fields are ALREADY set — do NOT ask about them again. Only ask for confirmation if the user brings them up."
  - "Ask ONLY about MISSING fields, in priority order: <missing list>."
  - "When everything required for <category> is filled, say the setup is complete and offer to save."
- Same for the `start` greeting: greet by `business_name` if known and immediately ask the first missing question instead of generic intro.

## 2. Persistent chat history

Store the wizard transcript in the existing `bot_settings` table under a single key `ai_training_chat_history` (JSON-serialized `ChatMessage[]`). No new tables.

In `src/components/AiTraining.tsx`:

- On mount, hydrate `chatMessages` from `settings.ai_training_chat_history` (parse JSON). If present, set `chatStarted = true` so the user lands back in their conversation.
- After every successful `startChat` / `sendMessage` / `generateAndApplySettings`, upsert `ai_training_chat_history` with the latest messages (debounced/awaited like other settings).
- Add a "Reset conversation" button that clears the key and resets local state (keeps configured fields intact).

## 3. Live "What I know" summary panel

Add a sidebar/card next to the chat (above on mobile) titled e.g. "Your business profile":

- Renders a checklist of the niche's expected fields from `CATEGORY_FIELDS[cat]` + core fields (business_name, reply_tone, faq count, never_say count).
- Each row shows: field label, a green check + truncated value if set, or a muted "Not set yet" with a small "Ask AI" button that drops a hint into the chat input.
- Re-derives from `settings` on every render, so it updates the moment `generateAndApplySettings` merges new values or the user edits manually.
- Progress bar: `filled / total` for the current niche.

## 4. Auto-merge as the chat progresses (optional but small)

Right now settings only merge when the user clicks "Generate & Save". To make the summary feel alive:

- After every 2 user turns, call `generate_settings` silently in the background and merge any new fields into `bot_settings`. Show a subtle "Updated: operating_hours, insurance_accepted" toast.
- Existing manual values are never overwritten (`mergeGeneratedSettings` already preserves non-empty fields — verify and keep that behavior).

## i18n

Add keys for: "Your business profile", "Not set yet", "Ask AI about this", "Reset conversation", "Profile complete", "Updated from chat: {fields}" across en/ko/es/bn.

## Out of scope

- No new DB tables, no schema changes.
- No changes to the FB webhook or runtime bot behavior.
- No changes to non-training tabs.

## Files touched

- `supabase/functions/ai-training-chat/index.ts` — known/missing fields in prompt, smarter greeting.
- `src/components/AiTraining.tsx` — hydrate/persist chat history, summary panel, reset button, optional auto-merge.
- `src/i18n/locales/{en,ko,es,bn}.json` — new keys.
