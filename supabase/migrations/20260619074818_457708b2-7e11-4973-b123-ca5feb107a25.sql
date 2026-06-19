
-- Extend fb_pages
ALTER TABLE public.fb_pages
  ADD COLUMN IF NOT EXISTS connected_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscribed_fields text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS subscription_error text,
  ADD COLUMN IF NOT EXISTS disconnected_at timestamptz,
  ADD COLUMN IF NOT EXISTS page_picture_url text;

-- Temporary OAuth sessions (service-role only)
CREATE TABLE IF NOT EXISTS public.fb_oauth_sessions (
  session_token text PRIMARY KEY,
  user_id uuid NOT NULL,
  user_access_token text NOT NULL,
  pages jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

GRANT ALL ON public.fb_oauth_sessions TO service_role;

ALTER TABLE public.fb_oauth_sessions ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon: only service_role (which bypasses RLS) may access.
CREATE INDEX IF NOT EXISTS fb_oauth_sessions_user_id_idx ON public.fb_oauth_sessions(user_id);
CREATE INDEX IF NOT EXISTS fb_oauth_sessions_expires_at_idx ON public.fb_oauth_sessions(expires_at);
