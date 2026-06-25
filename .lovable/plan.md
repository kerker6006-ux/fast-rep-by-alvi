## Root cause

`services.category` is the `business_category` enum (only `ecommerce|dental|hvac|salon`). On approve in `PendingProducts.tsx` we insert `category: (item.ai_category || "general")` — anything outside those four values fails the enum cast, so the insert silently errors and nothing happens. We'll switch services to free-text categories and split the FB import UI in two.

## 1. Database (one migration)

- `ALTER TABLE services ALTER COLUMN category DROP NOT NULL` (if NOT NULL), then `ALTER COLUMN category TYPE text USING category::text`. Free-text from now on.
- Add `services.keywords text[] default '{}'` and `services.duration_text` is already there — keep.
- Add `pending_products.kind text check (kind in ('product','service')) default 'product'` so the queue knows what each row will become.
- No new tables.

## 2. Fix approve (`src/components/PendingProducts.tsx`)

- Branch on `item.kind` (fall back to current `isServicePage` check for old rows).
- Service insert: map `ai_name → name`, `ai_description → description`, `ai_price → price_text` (string), `ai_category → category` (now free text), `ai_keywords → keywords`, `image_url`, `active: true`. Drop the enum cast.
- Product insert: unchanged.
- Surface insert errors via `toast.error` (currently swallowed because `onError` only fires on throw — already throws, but enum failure returns a Postgres error we should show verbatim).

## 3. Split FB import into two tabs

`PendingProducts.tsx` currently has one `FB Page Posts` tab using `FbPostsBrowser`. Replace with category-aware tabs:

- **Ecom pages**: tab `Import Products from FB` → existing `FbPostsBrowser` (renamed internal title).
- **Service pages**: new tab `Import Services from FB` → new `FbServicePostsBrowser.tsx`.
- Hide the irrelevant tab based on `activePage.page_category`.

### New `src/components/FbServicePostsBrowser.tsx`

Copy structure from `FbPostsBrowser`, but:
- On import, call a new edge function `import-fb-service-post` (below).
- Card shows: post image (optional thumbnail), caption preview, "Import as service" button.
- No color/material/price-number fields — services are described, not spec'd.

### New edge function `supabase/functions/import-fb-service-post/index.ts`

- Same auth + `user_has_page_access` check as `import-fb-post`.
- AI prompt tailored to services: extract `name`, `description` (what the service does, who it helps, problems it solves), `category` (free-text label like "Consultation", "Repair", "Treatment" — AI's best guess), `price_text` (string, may be "Contact for quote"), `duration_text`, `keywords[]` (English + Bangla terms a customer might use).
- Image is **optional** — if the FB post has no image we still import.
- Insert into `pending_products` with `kind = 'service'` and the AI fields mapped to existing `ai_*` columns; `ai_price` stays 0 (price_text lives in `ai_description` prefix or we add a new column — simpler: store full text in `ai_description`, put price string in `post_caption` suffix, OR add `pending_products.ai_price_text text`). **Decision**: add `ai_price_text text` and `ai_duration_text text` to `pending_products` in the same migration.

## 4. E-commerce category UX (AI free-text + suggestions)

Light touch — no new table:

- `import-fb-post` already returns AI `category` free text. Keep.
- In `PendingProducts.tsx` edit form, replace the category `<Input>` with a combobox: datalist of distinct existing `products.category` values for this page (fetched via React Query), plus free text. User picks an existing one or types new.
- Same combobox in `ProductsManager` add/edit dialog (small follow-up, optional — flag if user wants it now).

## 5. Service category UX (free-text, user-defined)

- In `ServicesManager.tsx` form, change category from enum select to free-text `<Input>` with datalist of distinct existing `services.category` values for this page.
- In approve flow (above), AI's `ai_category` flows in as the default; user can edit before approving.

## 6. Out of scope

- No changes to bot reply logic, webhook, pricing, or other modules.
- No migration of existing `services.category` values — they're enum strings that cast cleanly to text.

## Files touched

- migration: `services.category → text`, add `pending_products.kind`, `ai_price_text`, `ai_duration_text`
- `src/components/PendingProducts.tsx` — branch on kind, fix approve, split tabs, category combobox
- `src/components/FbPostsBrowser.tsx` — rename header, keep ecom-only
- `src/components/FbServicePostsBrowser.tsx` — new
- `src/components/ServicesManager.tsx` — free-text category with datalist
- `supabase/functions/import-fb-service-post/index.ts` — new
