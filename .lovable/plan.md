# Add Facebook Login (custom OAuth)

Since Lovable Cloud doesn't natively support Facebook auth, we'll build a custom OAuth flow using two edge functions and the Supabase Admin API to mint sessions. Google login stays as-is.

## What you'll get

- A second button on `/auth`: **Continue with Facebook**, next to Google.
- Users who sign in with FB land in `/dashboard`, same as Google users.
- If a user's Facebook email matches an existing Google account, they're auto-linked to the same user (same `auth.users` row).

## Implementation

### 1. New edge function: `fb-login-start`
- Requires no auth (public).
- Generates a signed `state` (reuses `_shared/fb.ts` helpers).
- Returns a Facebook OAuth URL with `scope=email,public_profile` and `redirect_uri` pointing to the callback function below.

### 2. New edge function: `fb-login-callback`
- Public endpoint hit by Facebook after consent.
- Verifies `state`, exchanges `code` → access token, fetches `id,email,name,picture` from `/me`.
- Rejects sign-in if Facebook didn't return an email (some FB accounts don't expose one).
- Calls Supabase Admin API:
  - Look up user by email; if missing, `admin.createUser({ email, email_confirm: true, user_metadata: { full_name, avatar_url, fb_id } })`.
  - Then `admin.generateLink({ type: 'magiclink', email })` to produce a one-time session link.
- 302 redirects the browser to that magic link, which Supabase auto-consumes and lands on `/dashboard` with an active session.

### 3. Frontend: `src/pages/Auth.tsx`
- Add a `FacebookIcon` SVG + a second button "Continue with Facebook" below the Google button, divided by an "or" separator.
- On click: `fetch` the `fb-login-start` URL, get the redirect URL, `window.location.href = url`.

### 4. Config
- Reuses existing `FB_APP_ID` / `FB_APP_SECRET` secrets (already set).
- No new database tables. The `fb_oauth_sessions` table used for Page connections is untouched.

## Manual step you'll do once

In your Facebook App → **Facebook Login → Settings**:
1. Add this Valid OAuth Redirect URI:
   `https://urtpathqupraeokaigzz.supabase.co/functions/v1/fb-login-callback`
2. Make sure **Facebook Login for Business** (or classic FB Login) product is added to the app and the `email` permission is approved (it's in the default tier, no review needed).
3. If your app is in Development mode, only test users / admins can log in until you switch to Live.

## Caveats

- FB accounts without an email (rare, mostly phone-only signups) can't sign in — they'll see a clear error.
- This bypasses the managed Lovable auth UI. Account linking is by email only; if a user uses a different email on FB vs Google, they'll get two separate accounts.
- The magic-link redirect path is a one-extra-hop redirect; UX is essentially identical to a normal OAuth.

Approve to build, or tell me what to change.
