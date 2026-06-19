# Full Project Health Audit

I checked everything end-to-end: database, RLS, edge functions, admin panel, bot logic, UI lazy-loading, and recent changes. Here's the report.

## ✅ What's healthy

- **Database**: 5 users, 17 products, 279 conversations, 4,628 messages, 6 orders, 869 recharges, 1,068 AI usage rows. All flowing.
- **Edge functions**: 21 functions deployed, all booting in 25–450ms, no crash loops.
- **FB webhook**: Receiving messages on the connected Dipto page, dedup index in place, credit checks active.
- **Multi-tenant RLS**: 22/23 public tables have policies, all scoped by `user_id` + admin escape hatch.
- **Recent fixes** (language picker, lazy-loaded routes, admin-list-users edge function, user_roles grants, AdminLogin race fix) — all live and working.
- **Lazy loading**: App.tsx + Index.tsx now ship per-route and per-tab chunks. Initial JS is tiny.

## ⚠️ Issues found (5)

### 1. `fb_oauth_sessions` has RLS enabled but **zero policies** → table is fully locked
Nothing can read or write it from the client. If FB OAuth ever goes through PostgREST it will silently fail. Need either: a policy, or confirm it's only touched by edge functions (service-role bypasses RLS) and leave it locked.

### 2. Public storage bucket `product-images` allows directory listing
Anyone can list every uploaded image URL. Should restrict `storage.objects` SELECT policy to authenticated owners while keeping individual file URLs public for FB Messenger delivery.

### 3. SECURITY DEFINER functions exposed to anon/authenticated
3 functions (likely `handle_new_user`, `handle_new_user_credits`, `update_updated_at_column`) are callable by signed-in users. Should `REVOKE EXECUTE ... FROM anon, authenticated` — they only need to run from triggers.

### 4. Leaked-password protection disabled in Auth
Users can sign up with passwords known to be in breach lists. One-toggle fix in Cloud auth config.

### 5. Admin sees other users' data in regular dashboard
You hit this with kerker6006: the "Admins read all products" RLS policy means when an admin opens the normal Products tab they see every tenant's products. Same applies to orders, conversations, etc. Confusing in daily use. **Fix:** scope the normal dashboard queries to `user_id = auth.uid()` explicitly in the client code, so cross-tenant view only happens inside `/admin/*` pages.

## 📋 Minor observations (not blockers)

- `leads`, `services`, `training_suggestions`, `admin_audit_log` each have only 1 policy — verify they cover INSERT/UPDATE/DELETE if the app writes to them.
- `send-scheduled` is being invoked ~every 20s (cron). Healthy, just noisy in logs.
- No errors in console; only a harmless `RESET_BLANK_CHECK` warning from the Lovable preview shell.

## Proposed implementation order

1. **Migration**: revoke EXECUTE on 3 SECURITY DEFINER functions; add a deny-all policy or service-role policy on `fb_oauth_sessions`.
2. **Migration**: tighten `storage.objects` SELECT policy on `product-images` bucket (keep file URLs publicly fetchable, block bucket listing).
3. **Frontend**: in `ProductsManager`, `OrdersManager`, `ConversationsView`, `ComplaintsManager` etc., add `.eq("user_id", user.id)` filters so admins see only their own data in the regular dashboard. Admin cross-tenant view stays under `/admin/*`.
4. **Auth config**: enable leaked-password protection in Lovable Cloud auth settings.
5. Verify with a fresh login as kerker6006 and as abraralvi to confirm each one sees only their own products in `/dashboard` while admin panel still shows everything.

Approve and I'll ship all 5 fixes.
