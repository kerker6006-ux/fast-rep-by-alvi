# Fast Rep → AI Receptionist Platform

Extend the existing app. Keep all current Facebook, Gemini, products, orders, conversations, credits, admin, and dashboard code working. Add a business category layer on top.

## 1. Business categories

Four fixed categories: `ecommerce`, `dental`, `hvac`, `salon`.

- Add `business_category` enum + column on `profiles` (nullable; null = not yet onboarded).
- After signup, if `business_category` is null, route the user to an **Onboarding** step that shows 4 large cards (E-commerce / Dental Clinic / HVAC & Home Services / Beauty Salon & Med Spa) with a one-line description each.
- Add a "Business Category" selector in **Bot Settings** so they can change it later.
- Sidebar adapts: e-commerce keeps "Products"; the 3 service verticals show "Services" instead. "Orders" becomes "Leads" for non-ecommerce.

## 2. Services + leads data model

New tables (per-user, RLS scoped to `auth.uid()`):

- `services` — `user_id`, `category`, `name`, `description`, `price_text`, `duration_text`, `service_area` (hvac), `faqs jsonb`, `image_url?`, `active`.
- `leads` — `user_id`, `category`, `name`, `phone`, `address?`, `service_or_product`, `preferred_date?`, `source` (facebook/instagram/manual), `conversation_id?`, `notes`, `status` (new/contacted/booked/closed), `created_at`.

Reuse existing `products` table for e-commerce. Reuse existing `conversations`/`messages`.

GRANTs + RLS per project standards.

## 3. Category-specific setup pages

One Settings shell, swaps body by category:

- **E-commerce** → existing Products manager + new fields surfaced (delivery info, return policy, FAQs stored on `profiles.business_info jsonb`). AI collects: Name, Phone, Product interested in.
- **Dental** → Services manager with preset templates (Implant, Braces, Whitening, Root Canal, Cleaning, Veneers). Fields: name, description, price range, duration, FAQs. AI collects: Patient Name, Phone, Service, Preferred date.
- **HVAC** → Services manager with presets (AC Repair/Install, Plumbing, Electrical, Cleaning, Roofing). Fields: name, description, price info, service area. AI collects: Name, Phone, Address, Service, Preferred visit date.
- **Salon / Med Spa** → Services manager with presets (Hair, Facial, Skin, Botox, Fillers, Laser). Fields: name, description, price, duration. AI collects: Name, Phone, Service, Appointment date.

Preset buttons just seed rows the user can edit/delete.

## 4. AI knowledge base + lead capture

Update `fb-webhook` + `ai-training-chat` prompt builder:

- Load `profiles.business_category`, `profiles.business_info`, and either `products` (ecommerce) or `services` (others) for that user.
- System prompt switches per category, framing the bot as an **AI Receptionist** whose job is to (a) answer from the knowledge base only — no hallucination, say "let me check with the team" if unknown — and (b) capture the required lead fields for that category.
- Reuse existing order-extraction pattern to extract lead fields after enough info is gathered, then insert into `leads` (ecommerce still also creates `orders` as today).
- Auto-reply rules and FAQ matching keep working unchanged.

## 5. Leads UI

New "Leads" page (sidebar item, shown for all categories — ecommerce sees it alongside Orders):

- Table: Name, Phone, Category, Service/Product, Source, Date, Status.
- Row click → drawer with full conversation transcript + notes + status dropdown.
- Filters: category, status, source, date.
- CSV export.

## 6. Marketing / wording pass

Replace "chatbot" / "auto-reply bot" wording with **AI Receptionist** / **AI Lead Conversion Assistant** / **AI Appointment Assistant** across:

- Landing/Index hero + features
- Auth page tagline
- Sidebar header
- Bot Settings intro
- All 4 locale files (en/ko/es/bn) — keys updated, all 4 languages translated to stay consistent with the strict-i18n rule.

Bot persona internals (short, plain, 1 emoji max) stay as-is.

## 7. Out of scope (not touched)

Billing rates, credits, Stripe, Facebook OAuth, webhook dedupe, admin panel, image generation pipeline, currency symbols.

## Technical notes

- Migration order per project rules: CREATE TABLE → GRANT (authenticated + service_role) → ENABLE RLS → POLICY.
- Enum: `CREATE TYPE business_category AS ENUM ('ecommerce','dental','hvac','salon');`
- `profiles.business_info jsonb` holds delivery info, return policy, hours, address, generic FAQs.
- Edge functions read category once per request and branch prompt + extraction schema.
- No schema changes to `products`, `orders`, `conversations`, `messages`.
- i18n: every new string added to all four locale files in the same change.

## Verification

- Create a fresh account → onboarding shows 4 cards → pick Dental → sidebar shows Services + Leads, no Products.
- Add 2 dental services → connect FB page → simulated inbound asks "how much are braces?" → bot answers from KB → after name+phone+date, a row appears in Leads.
- Switch category in settings to HVAC → Services list swaps, prior dental services preserved but hidden (filtered by category).
- Switch UI language to Korean → all new strings localized, no English leakage.
