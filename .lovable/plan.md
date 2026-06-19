## Goal
Make Fast Rep fully niche-aware end-to-end: the webhook AI uses the selected category's training/persona (not the hardcoded skincare/Bangla shop), the sidebar + every screen reflect the niche, AI Training only asks for what that niche needs (with preset templates), and all new strings translate fully in en/ko/es/bn.

## 1. Niche-aware webhook (`supabase/functions/fb-webhook/index.ts`)
Currently lines ~1053-1193 hardcode a Bangla skincare shopkeeper prompt for every user. Refactor so the system prompt is built from the user's `business_category`:

- Add `buildSystemPrompt(category, settings, businessInfo, services, products, websiteKnowledge, langSignals)` with **four mutually exclusive branches** (`ecommerce | dental | hvac | salon`).
- Shared header: identity, language mirroring rule (keep the existing Bangla/Banglish/English mirror), "answer only what is asked", reply length, never invent facts.
- **ecommerce branch**: keeps product catalog, category summary, image-compare logic, order collection, delivery/payment/return blocks. (Current behavior, just moved into this branch.)
- **dental / hvac / salon branches**: drop product catalog, skincare examples, "Korean", `SUGGEST_PRODUCT`, order/quantity flow. Inject Services list, Hours, Address, Insurance (dental), Service area (hvac), Emergency policy, Cancellation policy, Deposit policy (salon), FAQ list, Never-say list. Replace "ORDER COLLECTION" with **Appointment/Lead Capture** using the right fields per `leadFieldsByCategory`, ask one missing field at a time, then confirm.
- Persona defaults per category (overridable by `settings.ai_personality`): Dental → "polite clinic receptionist", HVAC → "dispatch coordinator", Salon → "front-desk concierge", Ecommerce → existing shopkeeper.
- `extractAndSaveLead` (already around line 1611) already branches by category — verify field list matches `leadFieldsByCategory` above and align.
- Same change for image handling: only ecommerce does product-image visual compare; service verticals just acknowledge an attachment and continue lead capture.

## 2. AI Training: niche-only fields + preset templates (`src/components/AiTraining.tsx`)
- `CATEGORY_FIELDS` already exists. Verify only the matching fields render (hide tabs/sections that reference delivery, returns, payment, product catalog, order examples when `cat !== "ecommerce"`).
- **Preset templates ("Load starter template" button per category)** that pre-fill empty fields with editable defaults:
  - **ecommerce**: delivery_info ("Inside Dhaka 60৳, outside 120৳, 1-3 days"), payment_methods ("Cash on Delivery, bKash, Nagad"), return_policy ("7-day return for unused items, buyer pays return shipping").
  - **dental**: operating_hours ("Sun-Thu 10am-8pm, Fri closed"), business_address (placeholder), insurance_accepted ("We accept ___; please share your card at the visit"), emergency_policy ("Same-day slots for acute pain — call front desk"), cancellation_policy ("Free reschedule 24h in advance; later cancellations forfeit deposit").
  - **hvac**: operating_hours ("Mon-Sat 8am-7pm; 24/7 emergency"), service_area_zips ("List your zip codes"), emergency_policy ("Same-day for no-heat / no-cool / leaks"), pricing_policy ("Free estimates over phone; on-site diagnostic $79 credited to repair").
  - **salon**: operating_hours ("Tue-Sun 10am-8pm"), business_address (placeholder), cancellation_policy ("24h notice required; no-show = deposit forfeit"), deposit_policy ("20% deposit on color/longer services, refundable up to 48h").
  - Templates live in a new helper `getPresetTemplate(cat)` returning a `SettingsMap`. "Load template" merges only into empty keys (never overwrites user edits) and marks `hasChanges`.
- Adapt the **chat wizard greeting + system prompt** to the category so it only asks niche-relevant questions (hours/address/insurance/emergency/cancellation/deposit/services for verticals; product list, delivery, returns, payment for ecommerce). Same for "AI-suggested FAQs" generator — pass `cat` so suggestions are vertical-specific.
- Header copy already swaps "Train your AI Receptionist" / "Train your AI Shopkeeper" — keep, verify it uses `t()` keys.
- Remove/hide the "Reply Examples" tab for service verticals (or relabel it to "Sample patient/client responses").

## 3. Sidebar + screens reflect the niche
- `DashboardSidebar.tsx`: already hides Products/Pending/Suggestions/Orders for service verticals and renames Leads→Appointments. Also relabel **`nav.conversations`** to "Patient chats" (dental) / "Client chats" (salon) / "Customer calls/chats" (hvac) via a small `labelForCategory()` helper; same treatment for `nav.complaints` → "Issue tickets" only when ecommerce.
- `ServicesManager.tsx` and `LeadsManager.tsx`: already use niche labels — verify all column headers, empty states, toasts, and CSV export labels go through `t()`.
- `ConversationsView.tsx`, `ComplaintsManager.tsx`, `AnalyticsDashboard.tsx`, `BotSettings.tsx`: replace any hardcoded "customer", "shop", "product", "order" strings with `t()` calls that resolve to the niche-correct word via a new `t("terms.customer")` / `t("terms.product")` namespace whose values differ per language (no per-category branching — instead expose a `useNicheTerms()` hook that returns `{ customer, item, booking, ... }` already translated).

## 4. i18n completeness (en/ko/es/bn)
- Audit added keys (`aiTraining.*`, `appointments.*`, `services.*`, `nav.appointments`, new preset placeholders, niche terms) and ensure all four locale files have them with native translations — no English fallbacks in ko/es/bn.
- Add a dev-time guard: a tiny script `scripts/check-i18n.mjs` that diffs key sets across the four files and prints missing keys. (Not run in build; for manual verification.)
- Verify `LanguageSwitcher` triggers a re-render of Services, Leads, AI Training, Sidebar — confirm components read `t()` inside render (not module scope).

## 5. Verification
1. Set category = Dental → sidebar shows Services + Appointments (no Products/Orders/Suggestions); AI Training shows only hours/address/insurance/emergency/cancellation + FAQ + Never-say; "Load template" fills clinic defaults; send a FB test message → webhook prompt logged contains "dental clinic receptionist" and no skincare/Bangla shopkeeper text; lead saved with `preferred_date`.
2. Switch language to Korean → every label in Services, Leads/Appointments, AI Training, Sidebar, BotSettings is Korean (spot-check 10 strings). Repeat for es and bn.
3. Switch category to Ecommerce → Products/Orders return, AI Training shows delivery/return/payment, webhook prompt contains product catalog.
4. Switch category to HVAC → service area + emergency fields appear; preset loads zip placeholder; webhook prompt contains "dispatch coordinator" persona and Services list.
5. Switch to Salon → cancellation + deposit fields appear; preset loads salon defaults.

## Out of scope
Calendar integration, SMS/email reminders, payment capture for deposits, new DB tables. All preset data is stored as plain rows in existing `bot_settings`.
