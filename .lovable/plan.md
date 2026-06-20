# Login with Google / Facebook — branding plan

## What you're asking for
1. Replace email/password login with social login only (Google + Facebook).
2. On the Google/Facebook consent screen, your app's own name should appear — not "Lovable" or any third party.

## Important reality check before we build

**Google sign-in** — Fully supported in Lovable Cloud. By default it uses Lovable's managed OAuth credentials, which means the consent screen will say something like *"…wants to access your Google Account via Lovable"*. To remove the Lovable name entirely, **you must create your own Google OAuth client** in Google Cloud Console and paste the Client ID + Secret into Cloud → Users → Auth Settings → Google. Then the consent screen shows **your app name + your verified domain** (e.g. leadpilot.life), no Lovable mention.

**Facebook sign-in** — **Not natively supported in Lovable Cloud.** You already have a Facebook App connected for the page-messaging bot (FB_APP_ID / FB_APP_SECRET), but that's for Page access, not user login. To add "Login with Facebook" for app sign-in I would need to either:
   - (a) migrate the project from Lovable Cloud to a self-managed Supabase project and enable the Facebook provider there, **or**
   - (b) build a custom OAuth flow on top of your existing FB app and mint Supabase sessions manually (more code, more edge cases).

I recommend (a) only if you really need FB login. Otherwise I'd suggest **Google-only** for sign-in and keep Facebook strictly for connecting pages.

## Plan (assuming Google-only, with your own OAuth credentials)

### 1. Auth configuration
- Enable Google provider via `configure_social_auth` with `providers: ["google"]`, `disable_providers: ["email"]`.
- This generates `src/integrations/lovable/` and installs `@lovable.dev/cloud-auth-js`.

### 2. Replace the Auth UI
- `src/pages/Auth.tsx`: remove email, password, confirm-password, display-name, forgot-password dialog, and the sign-in/sign-up toggle.
- Replace the form with a single **"Continue with Google"** button calling:
  ```ts
  await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/dashboard` })
  ```
- Keep the left-side branding panel, language switcher, mesh background.
- Translation keys in `src/i18n/locales/*.json`: add `auth.continueWithGoogle`, remove unused email/password keys (kept as fallback).

### 3. Remove now-dead pieces
- `/reset-password` route + page (no longer needed without email auth).
- `ChangePasswordDialog.tsx` (or hide it from settings, since users have no password).
- Any "Forgot password" UI.

### 4. Your-brand consent screen (manual step you do once)
After I ship the code, you do this in Google Cloud Console — I'll provide a checklist:
1. Create OAuth consent screen → External → App name "LeadPilot", support email, logo, authorized domain `leadpilot.life`.
2. Add scopes: `openid`, `userinfo.email`, `userinfo.profile`.
3. Create **OAuth 2.0 Client ID** (Web application).
4. Authorized redirect URI = the callback URL shown in Cloud → Users → Auth Settings → Google.
5. Paste Client ID + Secret into that same Lovable Cloud screen.

Result: Google's consent dialog reads *"LeadPilot wants to access your Google Account"* with your logo — no Lovable branding.

### 5. Existing users
Anyone who previously signed up with email/password will no longer be able to log in unless they use the same email address on Google (Supabase auto-links by email). This is usually fine, but flag it if you have many email users.

## Questions before I implement
1. **Facebook login**: skip it (Google-only) — or do you need both, accepting the migration to self-managed Supabase?
2. **Reset-password page + change-password dialog**: remove entirely, or keep hidden in case you re-enable email auth later?

Tell me your answers (or just say "Google-only, remove the dead pages") and I'll switch to build mode and implement.
