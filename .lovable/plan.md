## Goal
1. Fix the **Cost Breakdown** numbers shown in AI Usage screen.
2. Make the **language switcher actually translate every word** on the site — currently English has ~181 lines of translations but Korean / Spanish / Bangla only have ~82 lines, and many components still ship hardcoded English strings. Result: switching to Korean leaves most of the UI in English.

---

## Part 1 — Cost Breakdown fix (`src/components/AiUsageDashboard.tsx`)

Replace the static numbers so they match the real billing rates from `bot_settings` (the same rates Credits page already reads):

| Row | Before | After |
|---|---|---|
| Text message (AI reply) | `~$0.0005 / call` | `$0.003 / message` |
| Image analysis | `~$0.003 / call` | `$0.015 / image` |
| Order detection | `~$0.0002 / call` | **Free** (no separate AI call — piggybacks on the reply) |
| Auto-reply (keyword match) | Free | Free (unchanged) |

Pull `credit_cost_text` / `credit_cost_image` from `bot_settings` so if the admin changes pricing later, this card updates automatically (same pattern `CreditDashboard.tsx` already uses).

---

## Part 2 — Full multi-language coverage

### Audit findings
- `en.json` has full keys for nav, analytics, admin, auth, etc.
- `bn.json` / `ko.json` / `es.json` are **less than half the size** — missing whole sections (auth, analytics, common, fb, settings, app).
- Many components render **hardcoded English** instead of `t("…")` — e.g. CreditDashboard ("Credits & Billing", "Recharge Your Account", "How the AI Bot Works"), AiUsageDashboard ("Cost Breakdown", "AI Usage"), AiTraining ("Welcome Message", "FAQ", "Never Say", "Comment Auto-Reply", "Payment Methods", "Reply Tone", "Delivery Info"), AutoReplyRules ("Auto-Reply Rules", templates, dialog labels), BotSettings, OrdersManager, ProductsManager, ProductAiWizard, PendingProducts, ScheduledMessages, ComplaintsManager, ConversationsView, FbPageConnection, DashboardSidebar (some labels), Auth page, Index page, NotFound, etc.

### Work

**A. Expand the 3 non-English locales to full parity with `en.json`**
- Mirror every key from `en.json` into `bn.json`, `ko.json`, `es.json`.
- Translate **everything** into the target language — no English left, no language mixing (per the existing Core rule).

**B. Add the missing translation keys to `en.json` for everything currently hardcoded**
New sections to add (key names indicative):
- `credits.*` — title, balance, costPerMessage, textReply, imageReply, orderDetection, autoReplyKeyword, free, what10cGets, recharge.*, howBotWorks.*, transactionHistory, txTypes.*
- `aiUsage.*` — title, costBreakdown, todayUsage, last7Days, perCall, etc.
- `aiTraining.*` — businessProfile, replyTone, deliveryInfo, paymentMethods, welcomeMessage, outOfStockMessage, faq.*, neverSay.*, commentAutoReply.*, suggestions.*, save, etc.
- `autoReply.*` — title, subtitle, addRule, templates.*, dialog.*, priority, alternateLanguage, etc.
- `botSettings.*`, `orders.*`, `products.*` (form fields, preview, variants), `pendingProducts.*`, `productWizard.*`, `scheduled.*`, `complaints.*`, `chats.*`, `fbPages.*`, `sidebar.*`, `auth.*` extras, `notFound.*`, `landing.*`.

**C. Replace hardcoded strings in components with `t("…")` calls**
Files to refactor:
- `AiUsageDashboard.tsx`, `CreditDashboard.tsx`, `AiTraining.tsx`, `AutoReplyRules.tsx`, `BotSettings.tsx`, `OrdersManager.tsx`, `ProductsManager.tsx`, `PendingProducts.tsx`, `ProductAiWizard.tsx`, `ProductSuggestions.tsx`, `ScheduledMessages.tsx`, `ComplaintsManager.tsx`, `ConversationsView.tsx`, `FbPageConnection.tsx`, `FbPageAiAnalyzer.tsx`, `FbPostsBrowser.tsx`, `WebsiteImport.tsx`, `AnalyticsDashboard.tsx`, `DashboardSidebar.tsx`, admin pages, `Auth.tsx`, `Index.tsx`, `NotFound.tsx`.
- Toast messages (`toast.success("…")`) get `t()` too.
- Inline placeholders, dialog titles, button labels, empty states, badge labels — all of it.

**D. Keep these as-is (correct behavior)**
- Currency symbol stays `$` everywhere.
- Bot persona/AI reply text in `supabase/functions/fb-webhook` keeps its Bangla logic (that's the bot replying to customers, not UI).
- Language switcher names stay native (`English`, `한국어`, `বাংলা`, `Español`).

### Verification
After implementation, switch the UI to Korean and walk the whole app — sidebar, dashboard, credits, AI training (all cards, all suggestions), auto-reply rules + templates, products, orders, settings, admin. Nothing should remain in English. Repeat for Spanish and Bangla.

---

## Scope notes
This is a large refactor — roughly 20+ component files touched and ~300 new translation keys × 4 languages. No business logic, schema, or edge function changes. UI text only.
