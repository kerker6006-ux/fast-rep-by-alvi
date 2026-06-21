
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS alert_box_intro_dismissed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fb_24h_notice_dismissed boolean NOT NULL DEFAULT false;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS alert_seen_at timestamptz;
