# Make the bot a closer by default

Right now the system prompts say "Goal: close the order" / "Goal: book the appointment" but it's one line buried among many. I'll promote that mission to the TOP of the brain and reinforce it across every reply, plus carry the same conviction into the AI Training wizard so it interrogates the business model with that lens.

## What changes

### 1. `supabase/functions/fb-webhook/index.ts` — main reply brain
Add a new **MISSION** block at the very top of `systemPrompt` (before language, before persona) for all three verticals:

- Ecommerce → mission = close a sale (order with name + phone + address + product + qty)
- Service → mission = book an appointment (name + phone + service + date)
- Content creator → mission = enroll / capture lead for the right course

The block will state:
- Every reply must move the customer one step closer to buy / book / enroll.
- Never end a reply without either (a) asking the next qualifying question, (b) suggesting the right product/service/course, or (c) asking for the confirmation.
- Soft-influence tactics allowed: scarcity if true ("limited stock", "today's slot"), social proof if in KB, value framing tied to the customer's stated need.
- Never pushy, never repeat the same pitch twice, never invent discounts/offers, never beg.
- If customer is just browsing → still steer back with one concrete next step.

I'll also tighten the existing "REPLY STYLE" rule so "answer ONLY what was asked" is amended to "answer what was asked, then take ONE step toward closing."

### 2. `supabase/functions/ai-training-chat/index.ts` — training wizard
Promote business-model understanding so the wizard digs into what actually drives sales/appointments before saving:

- Add to `wizardByCategory` a line: "Your job is to deeply understand the business so the live bot can sell/book confidently. Ask about: target customer, top objection, why customers choose them over competitors, what closes a sale fastest, common buying signals."
- Add a new RULE: "Before marking setup complete, make sure you understand HOW this business actually wins customers (price? quality? speed? expertise?) and capture it into `business_description` / `ai_personality` so the bot can use it to influence buyers."

### 3. `bot_settings` — no schema change
Reuses existing fields (`business_description`, `ai_personality`, `custom_instructions`). The new conviction lives entirely in prompts, so no DB migration needed.

## Files edited
- `supabase/functions/fb-webhook/index.ts` (insert MISSION block into both `systemPrompt` branches around lines 1340 and 1394; tweak reply-style line)
- `supabase/functions/ai-training-chat/index.ts` (extend `wizardByCategory` strings and add rule around line 258)

## Out of scope
- No UI changes, no new settings field, no DB migration. If you later want a per-page toggle ("aggressive vs soft selling") I can add that as a follow-up.
