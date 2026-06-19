## Facebook Page Connection (One-Click OAuth)

Extends existing `fb_pages` table and `fb-webhook` function. Adds Meta OAuth login, page picker, auto webhook subscription, and a Connections management page.

### Step 1 — Create your Meta App (you do this, I'll guide)

Before I build, you need a Meta App. In chat I'll walk you through:
1. Go to developers.facebook.com → My Apps → Create App → type "Business".
2. Add products: **Facebook Login** and **Webhooks** and **Messenger**.
3. Facebook Login → Settings → add Valid OAuth Redirect URI:
   `https://urtpathqupraeokaigzz.supabase.co/functions/v1/fb-oauth-callback`
4. Copy **App ID** (public) and **App Secret** (secret).
5. Permissions needed (work in Dev Mode for admins/testers immediately; App Review required for public launch):
   `pages_show_list`, `pages_manage_metadata`, `pages_messaging`, `pages_read_engagement`, `pages_manage_engagement`, `leads_retrieval`, `pages_read_user_content`.
6. Webhooks → Page object → Callback URL = existing `fb-webhook` URL, subscribe to `messages`, `messaging_postbacks`, `feed`, `leadgen`.

Once you have App ID + App Secret, I'll request them via secret form: `FB_APP_ID`, `FB_APP_SECRET`. The existing `FB_VERIFY_TOKEN` / page tokens stay as-is.

### Step 2 — Database (migration)

Extend `public.fb_pages` (no breaking changes):
- `connected_at timestamptz default now()`
- `last_sync_at timestamptz`
- `subscribed_fields text[] default '{}'`
- `subscription_status text default 'pending'` — `pending | active | failed | disconnected`
- `subscription_error text`
- `disconnected_at timestamptz`
- Use existing `is_active` as the connected flag.

RLS already correct (user owns rows). No new table.

### Step 3 — Edge functions

**`fb-oauth-start`** (verify_jwt on)
- Requires logged-in user. Generates signed state `{user_id, nonce, ts}` (HMAC with `FB_APP_SECRET`), stores nonce in-memory not needed — verified by HMAC.
- Returns `{ url }` = `https://www.facebook.com/v21.0/dialog/oauth?client_id=FB_APP_ID&redirect_uri=...&state=...&scope=...&response_type=code`.

**`fb-oauth-callback`** (verify_jwt off, public — Facebook hits it)
- Validates `state` HMAC → extracts `user_id`.
- Exchanges `code` → short-lived user token → long-lived user token (`/oauth/access_token?grant_type=fb_exchange_token`).
- Fetches `/me/accounts?fields=id,name,access_token,tasks` → list of pages with page tokens (already long-lived).
- Stores pages in a short-lived `pending_fb_connections` row? Simpler: redirects back to app with `#fb_user_token=<long_lived>` fragment so it never touches our logs, OR caches pages keyed by a one-time code returned in query string.
- Chosen approach: store the long-lived user token encrypted in a temporary `fb_oauth_sessions` table with one-time `session_token` (10 min TTL), redirect to `/dashboard/facebook?session=<token>`.

**`fb-list-pages`** (verify_jwt on)
- Input: `session_token`. Verifies it belongs to caller. Returns page list (id, name, category, picture).

**`fb-connect-page`** (verify_jwt on)
- Input: `session_token`, `page_id`.
- Looks up page access token from session, upserts into `fb_pages` (user_id + fb_page_id unique).
- Calls Graph API `POST /{page-id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_deliveries,messaging_optins,feed,leadgen` using the page token.
- Updates `subscription_status='active'`, `subscribed_fields`, `last_sync_at`, `is_active=true`, `connected_at=now()`. Records failure if Graph errors.
- Deletes the session row.

**`fb-disconnect-page`** (verify_jwt on)
- Input: `fb_pages.id`. Calls `DELETE /{page-id}/subscribed_apps` with stored page token.
- Sets `is_active=false`, `subscription_status='disconnected'`, `disconnected_at=now()`, clears `page_access_token` (security).

**`fb-sync-page`** (verify_jwt on)
- Re-fetches page name + re-subscribes. Updates `last_sync_at`.

Add new functions to `supabase/config.toml`. `fb-oauth-callback` set `verify_jwt = false`.

### Step 4 — Temporary session table

```
fb_oauth_sessions(
  session_token text primary key,
  user_id uuid not null,
  user_access_token text not null,  -- long-lived
  pages jsonb not null,             -- [{id,name,access_token,category,picture}]
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '10 minutes'
)
```
RLS: only service_role. Grants accordingly. No anon/auth grants.

### Step 5 — Frontend

New files under `src/`:
- `pages/FacebookConnections.tsx` — list of connected pages (card grid): page name + avatar, Page ID, status badge (Active/Disconnected/Failed), last sync time, Sync button, Disconnect button (confirm). Empty state with big "Connect Facebook Page" CTA.
- `components/facebook/ConnectFacebookButton.tsx` — branded FB-blue button (`#1877F2`), Facebook "f" logo, loading spinner. Calls `fb-oauth-start` → `window.location.href = url`.
- `components/facebook/PageSelectModal.tsx` — shadcn Dialog. Reads `?session=` from URL on `FacebookConnections` mount, calls `fb-list-pages`, renders selectable list with avatars + categories, Confirm button → `fb-connect-page` → toast "Facebook Page Connected Successfully" → refresh list → clean URL.
- `components/facebook/ConnectedPageCard.tsx` — single page card.
- Add route `/dashboard/facebook` in router; add nav entry in dashboard sidebar.
- Add a small "Connect Facebook Page" card on main dashboard linking to the page.

UX: loading skeletons, error toasts, mobile-responsive grid (1 col mobile, 2-3 desktop), uses existing design tokens.

### Step 6 — Webhook subscription guarantee

`fb-webhook` already handles messages/feed; no code change needed there. The new `fb-connect-page` ensures pages are subscribed via `/subscribed_apps` so Meta starts delivering events. If user added more pages in Meta later, "Sync" re-subscribes.

### Step 7 — Success / error states

- Toasts: success on connect/disconnect/sync; specific errors for "Token expired — reconnect", "Missing permission — re-authorize".
- Status badges colored: green active, amber pending, red failed, gray disconnected.

### Technical notes

- All Graph calls use API version `v21.0`.
- State HMAC: `crypto.subtle` HMAC-SHA256 with `FB_APP_SECRET`.
- Long-lived page tokens (returned from `/me/accounts` after long-lived user token) don't expire normally — but we still expose Sync/Reconnect.
- Never log tokens. On disconnect we null out `page_access_token`.
- `FB_APP_ID` is read on the client via a tiny `fb-config` edge function (or hardcoded in start function only) — kept server-side; client never sees App Secret.

### Build order

1. Migration (extend `fb_pages` + create `fb_oauth_sessions`).
2. Request `FB_APP_ID`, `FB_APP_SECRET` secrets.
3. Edge functions: `fb-oauth-start`, `fb-oauth-callback`, `fb-list-pages`, `fb-connect-page`, `fb-disconnect-page`, `fb-sync-page`.
4. Frontend page + components + route + dashboard CTA.
5. Smoke test with your test page.

Approve to start, and I'll kick off with the Meta App walkthrough + migration.