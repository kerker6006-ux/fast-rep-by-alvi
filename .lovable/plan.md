
## Goal
Stop the bot from repeating itself and make it actually read + understand the full conversation (including messages from hours/days ago), so when a returning customer says "still thinking about that" the bot knows they meant Product X.

## Edits — `supabase/functions/fb-webhook/index.ts` → `generateAiReply`

### 1. Pull more history + a real summary of older turns
- Increase per-request history from last 50 to last 80 messages, ordered chronologically (keep token budget safe via trimming below).
- Build a lightweight **conversation memory block** appended to the system prompt:
  - Last assistant reply (verbatim, marked "YOUR LAST REPLY — DO NOT REPEAT THIS").
  - Last 2 assistant replies (marked "RECENT BOT REPLIES — vary wording, do not paraphrase these").
  - A bullet list of **topics the customer has discussed so far**: product names, services, sizes/colors, prices mentioned, order details collected (name/phone/address), time since last message ("Customer returned after 3h 12m").
- This block is computed in code from the message rows; no extra AI call needed.

### 2. Carry-over context for returning customers
- When the new incoming message is short / vague ("ok?", "still there?", "what about that one", "hmm"), detect it (length < 25 chars OR matches a small vague-pronoun regex) AND look back through the last 20 messages to find:
  - Last product/service the bot mentioned.
  - Last open question the bot asked.
- Inject a "LIKELY REFERRING TO: <product/service/topic>" hint into the system prompt so the model resolves the reference instead of restarting.

### 3. Anti-repeat guard
- After model returns `cleanedReply`, compare against the **last 2 outgoing messages** using normalized token overlap (lowercase, strip punct, Jaccard ≥ 0.75).
- If it's effectively the same reply:
  - Re-call the model **once** with an extra system line: "Your previous reply was '<X>'. The customer is still here — do NOT repeat it. Move the conversation forward with the NEXT logical step (ask the next missing detail, recommend a fitting product/service, or ask one clarifying question)."
  - Use `gemini-2.5-flash` for the retry (not lite).

### 4. Smarter default model
- Today: lite first, escalate only if "weak". This is why answers feel shallow.
- New rule: use `gemini-2.5-flash` whenever ANY of:
  - History has ≥ 6 messages (real conversation, needs context understanding).
  - Customer message references a pronoun / "that" / "it" / Bangla equivalents (ওটা, সেটা, এটা).
  - Image attached, long message, or many products — existing triggers stay.
- Lite stays only for first 1–2 short messages of a brand-new chat.

### 5. Prompt additions (single new section)
Add a `CONVERSATION CONTINUITY` section to both ecommerce and service/creator prompts:
- "Before replying, silently summarize what the customer has been asking about across the whole thread above. If they return after a gap, assume they're continuing the same topic unless they clearly switch."
- "Never send the same sentence or pitch twice. If your last reply already asked a question and they answered partially, acknowledge their answer and ask the NEXT missing thing — never re-ask the same thing."
- "If the customer's new message is short/ambiguous (e.g. 'ok', 'still thinking', 'that one'), resolve it from prior turns instead of asking 'what do you mean?'."

## Out of scope
- No DB migration. No new tables. Order/complaint/lead extraction paths untouched. UI unchanged.
- AI Training wizard untouched (the user is asking about the live reply bot).

## Verification
- After edit, send 3 test messages via `supabase--curl_edge_functions` simulating: (a) a product question, (b) a 4-hour-later "still there?" follow-up, (c) the same question repeated — confirm replies differ and the follow-up resolves to the original product.
