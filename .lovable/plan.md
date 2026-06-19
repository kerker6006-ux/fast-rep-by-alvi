## Goal
Eliminate all language mixing in the Credits section and Welcome Message settings, and display all pricing in US dollars/cents with clear per-message and per-image calculations.

## Changes

### 1. `src/components/CreditDashboard.tsx` — English only, USD only
- Remove the Bangla/English `Tabs` entirely. Keep one English version of the pricing card, recharge card, and "How the AI Bot Works" card.
- Replace every `৳` symbol with `$` and reformat numbers (e.g. `$0.003 / message`, `$0.015 / image`).
- Subtitle: "Your credit balance and recharge info" (no Bangla).
- Balance label: "Current Balance" only.
- Transaction History title: "Transaction History" only. Transaction type label: "Recharge" only (drop "রিচার্জ").
- Recharge section: rename "Recharge via bKash" → "Recharge" with a generic instruction ("Contact admin to add credits to your account"), since bKash/Taka context no longer fits a USD UI. (If you prefer to keep bKash wording, say so and I'll keep it in English only.)
- Add a small "What you get" helper block under the pricing card:
  ```
  $0.10 (10¢) gets you approximately:
   • ~33 AI text replies   (at $0.003 each)
   • ~6 AI image replies   (at $0.015 each)
  ```

### 2. Pricing rates (USD)
Default rates stored in `bot_settings` switch from Taka to dollars:
- `credit_cost_text`: **$0.003** per text reply (0.3¢)
- `credit_cost_image`: **$0.015** per image reply (1.5¢)

So per 10¢:
- Text messages: 10 / 0.3 ≈ **33 messages**
- Image replies: 10 / 1.5 ≈ **6 images** (1 image = **1.5¢**)

These are the defaults shown when a user has no override. Existing DB values are left untouched (no migration), so anyone with custom rates keeps them; only the displayed currency symbol and the fallback defaults change.

### 3. Welcome message — single field
Remove the dual Bangla + English welcome inputs in both places. The user picks ONE welcome message in their chosen language.

- `src/components/BotSettings.tsx` (lines ~93–105): remove the "Welcome Message (English)" textarea and `welcome_message_en` field. Keep a single "Welcome Message" textarea bound to `welcome_message` with a neutral placeholder ("Type your welcome message…").
- `src/components/AiTraining.tsx` (lines ~488–505): same — remove the `welcome_message_en` input, keep only `welcome_message` with neutral placeholder.
- The webhook/bot runtime already reads `welcome_message`; the `_en` field simply stops being written. No backend change required.

### 4. Out of scope (not touched)
- Product prices (`ProductsManager`, `OrdersManager`, `AnalyticsDashboard`, admin recharge views) still use ৳ because those are merchant-facing local-currency sales numbers, not platform billing. Tell me if you want those switched to $ too.
- No DB migration; no edge function changes.

## Technical notes
- Default fallbacks in `CreditDashboard.tsx` change: `Number(settingsMap.credit_cost_text) || 0.003` and `… || 0.015`.
- Format helper: show `$${cost.toFixed(3)}` for text and `$${cost.toFixed(3)}` for image so sub-cent values render correctly.
