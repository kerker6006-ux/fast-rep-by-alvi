# Auth hardening + per-user data isolation

## 1. Signup: confirm password
In `src/pages/Auth.tsx`, add a "Confirm password" field to the signup form. Validate with zod:
- password: min 8 chars
- confirmPassword: must match password
Show inline error if mismatch; block submit until they match.

## 2. Forgot password flow
- On `src/pages/Auth.tsx` (sign-in tab): add a "Forgot password?" link that opens a small dialog/section asking for email, then calls:
  ```ts
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
  ```
- Create new page `src/pages/ResetPassword.tsx` (public route in `src/App.tsx`):
  - Detects Supabase recovery session from the URL
  - Form: new password + confirm new password (zod validation)
  - Calls `supabase.auth.updateUser({ password })`
  - On success redirects to `/dashboard`
- Add `/reset-password` route to `App.tsx` (unprotected).

## 3. Change password (any logged-in user)
In the existing Settings/Account area (or a new "Security" card in Settings), add a "Change password" form:
- Current password (re-auth via `signInWithPassword` using current email)
- New password + confirm
- Calls `supabase.auth.updateUser({ password })`

## 4. Admin: reset a user's password
In the Admin Users page, add a "Send password reset" action per user. This triggers `resetPasswordForEmail` for that user's email (no admin-set password — Supabase does not allow setting another user's password from the client). The user receives the reset email and uses `/reset-password`.

> Note: directly setting another user's password requires the service role key, which is not exposed on Lovable Cloud. The reset-email approach is the supported pattern.

## 5. Per-user data isolation audit (RLS)
Review every user-owned table and ensure RLS policies scope every SELECT/INSERT/UPDATE/DELETE to `auth.uid() = user_id` (or via `fb_pages.user_id` for child rows). Tables to verify:
`profiles, user_credits, credit_transactions, fb_pages, conversations, messages, products, pending_products, product_suggestions, orders, leads, complaints, auto_reply_rules, bot_settings, scheduled_messages, services, website_knowledge, announcements, ai_usage, app_settings`.

I will run `supabase--read_query` to dump current policies, then write a single migration that:
- Drops any overly permissive policies
- Recreates strict per-user policies
- Keeps admin overrides via `has_role(auth.uid(), 'admin')`
- Ensures GRANTs are correct

Nothing in the UI changes for data isolation — it's a backend correctness pass.

## 6. Email templates (optional, recommended)
The password reset link is sent via Supabase auth email. Default template works. If you want it branded as LeadPilot, I can scaffold custom auth email templates after a sender domain is configured — say the word and I'll add it.

## Files touched
- edit: `src/pages/Auth.tsx` (confirm password, forgot password link)
- create: `src/pages/ResetPassword.tsx`
- edit: `src/App.tsx` (add `/reset-password` route)
- edit: Settings page (add change-password card)
- edit: Admin Users page (add "Send reset email" button)
- new migration: tighten RLS policies for per-user isolation
