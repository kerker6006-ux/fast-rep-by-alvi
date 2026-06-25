## Goal

Make `services` behave like products: optional image, with the AI matching customer messages to services via name + description keywords, and proactively suggesting the right service.

## 1. ServicesManager UI (`src/components/ServicesManager.tsx`)

- Add **optional image upload** field in the form (reusing the `product-images` bucket pattern already used elsewhere — upload to storage, save public URL into `services.image_url`). Show preview + "Remove image" button. Label clearly as **Optional**.
- Keep **Name** and **Description** as the primary, prominent inputs (larger textarea, helper text: "Describe what this service is for, who it helps, and common problems it solves — the AI uses this to suggest it to customers").
- Display thumbnail in the service list card when `image_url` is set.
- No schema migration needed — `image_url` column already exists.

## 2. AI matching & suggestion logic (`supabase/functions/fb-webhook/index.ts`)

Currently the service prompt only lists services as static text. Upgrade it so the bot actively matches and suggests:

- Extend the `services` select to also pull `image_url` and `id`.
- Build a **keyword index** per service in code: tokenize `name + description` (lowercase, strip punctuation, drop stopwords) → store as `keywords[]` alongside each service.
- Before composing the reply, score each service against the incoming customer message (simple overlap of message tokens vs service keywords, plus substring match on name). Pick top 1–2 matches.
- Inject a `SUGGESTED SERVICES FOR THIS MESSAGE` block into the system prompt with the matched service name, description, price, and `image_url`, and instruct the AI to:
  - Recommend the matched service by name when relevant.
  - Briefly explain *why* it fits (based on description).
  - Stay within the existing brevity / tone rules.
- Reuse the existing proactive-image send path: if a matched service has an `image_url`, send it via Graph API before the text reply (same helper already used for products).
- Keep the full services list in the prompt as fallback context so unrelated questions still work.

## 3. Out of scope

- No changes to products, orders, or other modules.
- No new DB tables or migrations.
- No changes to bot brevity rules or pricing.

## Technical notes

- Stopword list kept inline (en + bn basics: "the, a, is, for, আমি, কি, এর, ও" …) — small and good enough for short FB DMs.
- Scoring: `score = 2*name_substring_hits + keyword_overlap_count`; threshold `>=2` to count as a match.
- Image upload reuses existing `supabase.storage.from("product-images").upload(...)` pattern — no new bucket.
