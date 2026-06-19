# Plan: Category-aware Services, AI Training & Leads

Goal: make the platform feel professionally niche per category. Service verticals (Dental, HVAC, Salon) should speak in "Appointments" language; E-commerce keeps Delivery/Shipping. AI Training adapts its fields, presets, and chat wizard to the selected category.

## 1. Services → Appointments framing (service categories only)

In `ServicesManager.tsx` and `LeadsManager.tsx`:
- Read `business_category` via `useBusinessCategory`.
- Rebrand labels when category ∈ {dental, hvac, salon}:
  - Page title: "Services & Appointments" (Dental: "Treatments & Appointments", HVAC: "Services & Job Bookings", Salon: "Treatments & Bookings").
  - "Leads" tab/page → "Appointments" for service verticals; stays "Leads" for ecommerce.
  - Add columns relevant to appointments: `preferred_date`, `status` chips (New / Booked / Completed / No-show).
  - Quick actions: "Mark Booked", "Mark Completed".
- Add category-specific service presets (one-click seed):
  - Dental: Cleaning, Whitening, Implant, Braces, Root Canal, Emergency Visit.
  - HVAC: AC Repair, AC Install, Heating, Plumbing, Duct Cleaning, Emergency Call.
  - Salon: Haircut, Color, Facial, Manicure, Botox, Massage.
- Each service row exposes: name, description, price text, duration, service area (HVAC only), active toggle.

## 2. AI Training adapts per category

`AiTraining.tsx` currently shows a single shopkeeper-style form with `delivery_info`, `return_policy`, etc. Refactor to a category-driven schema:

- New helper `getTrainingSchemaForCategory(cat)` returning the fields, labels, placeholders, and chat-wizard prompts for that vertical.
- Field groups by category:
  - **ecommerce**: Business info, Delivery info, Return policy, Payment methods, FAQs, Never-say list. (unchanged)
  - **dental**: Clinic info, Operating hours, Address, Insurance accepted, Emergency policy, FAQs, Never-say list. (NO delivery/return)
  - **hvac**: Company info, Service area / zip codes, Operating hours, Emergency availability, Pricing/estimate policy, FAQs, Never-say list.
  - **salon**: Salon info, Operating hours, Address, Cancellation policy, Booking deposit policy, FAQs, Never-say list.
- Quick-test panel's seeded prompts swap per category (Dental: "Do you take Delta Dental?", HVAC: "Do you service 90210?", Salon: "Can I book a facial Saturday?").
- AI chat wizard system prompt branches by category so generated settings match the schema above (no delivery info for service verticals).
- "AI-suggested FAQs" generator passes category context so suggestions are domain-appropriate.
- Rebrand header copy: "Train your AI Receptionist" (service) vs "Train your AI Shopkeeper" (ecommerce).

## 3. Wording & icons

- BotSettings, sidebar, dashboard cards: when category is a service vertical, replace "Orders" with "Appointments", "Customers" with "Patients" (dental) / "Clients" (salon) / "Customers" (hvac).
- Sidebar already swaps Products/Services — extend to also rename Leads → Appointments for service verticals.

## 4. i18n

Add keys to all four locale files (`en/ko/es/bn.json`):
- `services.appointments.*`, `aiTraining.dental.*`, `aiTraining.hvac.*`, `aiTraining.salon.*`, status chips, preset names, chat wizard greetings per category.
- Remove/hide existing delivery/return strings in service-vertical views (keys remain for ecommerce).

## 5. Edge function alignment

`supabase/functions/fb-webhook/index.ts`:
- Knowledge-base assembly already branches on category. Extend so it pulls the new category-specific fields (insurance, service area, hours, cancellation policy) instead of delivery/return when not ecommerce.
- Lead extraction prompt for service verticals targets: name, phone, preferred date/time, service requested, address (HVAC only), notes.

## Technical notes

- No new tables. Add optional keys into existing `bot_settings` (`setting_key` is free-form text already). Examples: `operating_hours`, `service_area_zips`, `insurance_accepted`, `cancellation_policy`, `emergency_policy`.
- `LeadsManager` reuses existing `leads` table; status chips driven by `leads.status`.
- All copy via `t()`; no hardcoded strings.

## Out of scope

- Calendar integration / real booking system (only intake + status chips).
- Payment/deposit collection.
- SMS reminders.

## Verification

1. Switch category to Dental → AiTraining shows clinic/hours/insurance fields, no delivery field; ServicesManager titled "Treatments & Appointments"; sidebar shows "Appointments".
2. Switch to E-commerce → delivery + return fields reappear; sidebar shows Products + Leads.
3. Switch language to Korean → all new labels localized.
4. Trigger FB webhook with a Dental account → AI replies using clinic KB and saves lead with preferred_date.
