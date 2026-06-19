# Plan: Standalone Admin Panel + Full i18n + FB Connect Hardening

## 1. Admin Access (kerker6006@gmail.com / admin121)

- Auto-promote that exact email to `admin` role in `user_roles` whenever they sign in or sign up (handled in DB trigger + a client-side ensure call).
- All `/admin/*` routes wrapped in an `AdminRoute` guard that checks `has_role(uid, 'admin')`. Non-admins get redirected to `/dashboard` (or `/auth`).
- Password `admin121` is just the account password the user creates on signup — I'll instruct them to sign up once with that email/password; the trigger handles role assignment.

## 2. Separate `/admin` Panel (full-featured)

New routes under a dedicated `AdminLayout` (independent from user dashboard sidebar):

- `/admin` — Overview: KPIs (total users, active bots, revenue, AI spend, FB pages connected, messages today, orders today), charts (signups/week, revenue/month, AI usage/day).
- `/admin/users` — Searchable user table: email, signup date, credit balance, bot status, FB pages, last active. Actions: add/remove credits (with reason + transaction log), suspend/unsuspend, delete account, view detail drawer.
- `/admin/recharges` — Pending manual recharge requests: approve/reject with one click, adds credit + writes `credit_transactions`.
- `/admin/payments` — Stripe placeholder (UI scaffolded, "Connect Stripe" CTA). Wires up when keys arrive.
- `/admin/pricing` — Edit global `pricing_settings` (৳/text, ৳/image, signup bonus). Stored in new `app_settings` table.
- `/admin/fb-pages` — All connected FB pages across all users; force-disconnect, view sync status.
- `/admin/announcements` — Compose & send broadcast notifications to all users.
- `/admin/analytics` — Deeper analytics (per-user AI usage, top spenders, model breakdown).
- `/admin/settings` — Admin profile + sign out.

### UI direction
- Same white & blue palette + Space Grotesk / DM Sans, but **dedicated admin shell** (dark navy sidebar accent, sticky top bar with quick search, breadcrumbs, command palette `Cmd+K` for jump-to-user).
- Bento-grid overview cards with sparkline charts (recharts).
- Drawers/dialogs for destructive actions with confirm-by-type pattern.
- Everything keyboard-accessible, table rows clickable, toast on every mutation.

## 3. Database Changes

- New table `app_settings` (key/value) — pricing config, signup bonus.
- New table `announcements` (id, title, body, audience, created_by, created_at).
- New table `admin_audit_log` (admin_id, action, target_user, payload, created_at) — every admin action recorded.
- `profiles.suspended` boolean column.
- Updated trigger `handle_new_user`: if email = `kerker6006@gmail.com`, auto-insert `user_roles(user_id, 'admin')`.
- Edge function `admin-adjust-credits` (service-role) for safe credit add/remove with audit log.
- Edge function `admin-broadcast` for announcements.
- Edge function `admin-delete-user` (auth.admin.deleteUser).
- RLS: admin tables only readable/writable via `has_role(uid,'admin')`.

## 4. Full i18n Pass — No Mixing

Translate every screen for EN / KO / BN / ES:
- Auth, Dashboard, Sidebar, Products, Orders, Conversations, Complaints, Settings, Wizards (Training, Product), FB Connection, Auto-reply rules, Scheduled messages, Credits/Recharge, Admin panel.
- All toast messages, button labels, table headers, empty states, validation errors moved to `src/i18n/locales/*.json`.
- Lint pass: search for hardcoded English strings in `src/**/*.tsx` and convert to `t()`.
- Language preference persists per user in `profiles.language` (already in localStorage; sync to DB).

## 5. FB Connect Verification

- Audit all 6 edge functions (`fb-connect-page`, `fb-disconnect-page`, `fb-list-pages`, `fb-oauth-callback`, `fb-oauth-start`, `fb-sync-page`).
- Verify redirect URI is the deployed function URL and matches what's configured in the FB App dashboard.
- Add clearer error toasts in `FbPageConnection.tsx` (show actual Graph API error message instead of generic failure).
- Add a "Test Connection" button that calls `/me` on the stored page token and reports back.
- Document the exact Valid OAuth Redirect URI to paste in the FB App settings.

## 6. Order of Operations

1. DB migration (admin role trigger, app_settings, announcements, audit log, suspended col).
2. Admin edge functions (adjust-credits, broadcast, delete-user).
3. `AdminRoute` + `AdminLayout` + admin pages.
4. i18n pass (all locale files + replace strings across app).
5. FB Connect audit + Test Connection button.
6. Manual verification via Playwright: sign up kerker6006@gmail.com → confirm `/admin` accessible → adjust credits on a test user → switch language → verify no English bleeds through in Korean mode.

## Technical Notes

- Admin guard uses `has_role()` RPC (already exists), no client-trustable flags.
- Credit adjustments go through service-role edge functions only — never direct table writes from client.
- All admin actions write to `admin_audit_log` for accountability.
- Stripe panel ships as a stub today; when you add Stripe secret, I wire `stripe-checkout` + webhook to credit users automatically.

## Open Questions (none blocking)
- FB Connect: you didn't report a specific error, so I'll just audit + harden + add a Test button. If you hit a specific error after, paste it and I'll fix that case.
