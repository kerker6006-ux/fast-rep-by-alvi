## Goal
Switch auth to Google + Facebook only, collect onboarding info from new users, and show a full user detail view in the admin panel.

## 1. Auth page (`src/pages/Auth.tsx`)
- Remove the email/password tabs (sign-in + sign-up), the `displayName`/`email`/`password` state, and `handleEmailSubmit`.
- Keep only two big buttons: **Continue with Google** and **Continue with Facebook**.
- Keep language switcher, logo, and the small "By continuing you agree to…" footer.
- Forgot-password UI (if any) removed.

Note: email/password remains enabled in the backend so existing accounts still work; we only hide it from the UI. (If you want it fully disabled at the backend level too, say so and I'll add that.)

## 2. Onboarding for new users
Add a new page `src/pages/Onboarding.tsx` shown the first time a user lands after Google/Facebook sign-in when their profile is missing the required fields.

Fields collected:
- **Full name** (prefilled from Google profile, editable)
- **What do you do?** — radio: `Business owner`, `Content creator`, `Other`
- **Country** — searchable select (full ISO country list)

On submit → update `public.profiles` and route to `/dashboard`.

Routing:
- In `AuthContext` (or a small `OnboardingGate` wrapper around protected routes), after session is loaded fetch the user's profile; if `business_info.onboarded !== true`, redirect to `/onboarding`.
- `/onboarding` itself is auth-required but skips the gate.

## 3. Database (migration)
Add columns to `public.profiles`:
- `full_name text`
- `user_type text` check in (`business`, `creator`, `other`)
- `country text` (ISO-2 code)
- `onboarded_at timestamptz`

Update `handle_new_user()` trigger to also copy `full_name` from `raw_user_meta_data->>'full_name'` / `name` when present.

(No new RLS needed — existing profile policies already cover these columns.)

## 4. Admin Users panel (`src/pages/admin/AdminUsers.tsx`)
Change the list view to a compact table showing only **Name** and **Email** per row, plus a small status dot (approved/suspended). Clicking a row opens a **User Details** dialog.

User Details dialog content:
- Header: avatar, full name, email, country flag + name, user type, joined date, approved/suspended badges.
- Stats grid:
  - **Balance** (credits)
  - **Connected FB pages** (count + list with page name)
  - **Products** count
  - **Orders** count
  - **Messages** count (last 30d)
  - **Total spent on AI** (sum of `ai_usage.cost`)
- Action buttons (kept from current page): Add credits, Remove credits, Suspend/Unsuspend, Delete, Reset password (if applicable).

Data source: extend the existing `admin-list-users` edge function (or add a new `admin-user-details` function) to return the per-user aggregates in one call when a user is opened. The list query stays light (name + email + status only) for speed.

## 5. i18n
Add new strings (English + Korean + Bangla + Spanish) for:
- Auth page tagline ("Sign in to Lead Pilot")
- Onboarding ("Welcome", "What's your name", "What do you do", "Where are you from", "Continue")
- Admin details labels (Balance, Pages, Products, Orders, Messages, AI spend, Country, User type)

## Technical notes
- Country list: ship a small static `src/data/countries.ts` (ISO-2 + name + emoji flag), no API call.
- The Facebook OAuth flow already exists via `fb-login-start` edge function — unchanged.
- Onboarding gate logic lives in `AuthContext` so it covers every protected route automatically.
- Admin details dialog fetches aggregates lazily on open (one RPC) so the user list stays fast even with many users.

## Out of scope (ask if you want them)
- Disabling email/password at the backend / blocking existing email-based logins.
- Editing the onboarding answers later from the user's own settings page.
- Showing per-page analytics inside the admin details dialog.
