## What's happening

Facebook is rejecting the login dialog because your **redirect URI's domain isn't whitelisted** in the Facebook App settings. This is a config change inside developers.facebook.com — no code change can fix it.

Our OAuth callback URL is:
```
https://urtpathqupraeokaigzz.supabase.co/functions/v1/fb-oauth-callback
```

And users return to your app at:
```
https://fast-rep-by-alvi.lovable.app
https://id-preview--8dfc4fd9-3e32-491b-b4d5-e6f5960d40f3.lovable.app
```

## Fix (do this in Facebook Developer Console)

### 1. App Domains
**Settings → Basic → App Domains** — add all three:
```
urtpathqupraeokaigzz.supabase.co
fast-rep-by-alvi.lovable.app
lovable.app
```
Then click **Save Changes** at the bottom.

### 2. Site URL
Same page, scroll down → **+ Add Platform → Website → Site URL**:
```
https://fast-rep-by-alvi.lovable.app
```
Save.

### 3. Valid OAuth Redirect URI
**Use cases → Customize → Facebook Login for Business → Settings** (or the product where your Configuration ID `28436308939291186` lives) → **Valid OAuth Redirect URIs** — add:
```
https://urtpathqupraeokaigzz.supabase.co/functions/v1/fb-oauth-callback
```
Save changes.

### 4. App Mode
Top bar of the app dashboard — if it says **"In development"**, only listed test users / admins can log in. Either:
- Add the testing FB account under **App roles → Roles → Add People → Testers**, OR
- Switch the app to **Live** mode (requires a privacy policy URL in Settings → Basic).

## After saving

Wait ~30 seconds, then click **Connect Facebook Page** again. The dialog should load instead of showing the domain error.

If it still fails, send a screenshot of the new error — most likely it will be a different message (permissions, app mode, or business verification) and I'll walk you through that next.

## No code changes in this plan

Everything above is Facebook dashboard config. Approve this plan only as confirmation you've read it — there's nothing for me to build until you report back what happens after updating the FB settings.