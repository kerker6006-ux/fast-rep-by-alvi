
ALTER TABLE public.fb_pages
  ADD COLUMN IF NOT EXISTS ig_business_account_id text,
  ADD COLUMN IF NOT EXISTS ig_username text,
  ADD COLUMN IF NOT EXISTS ig_picture_url text,
  ADD COLUMN IF NOT EXISTS ig_subscription_status text;

CREATE UNIQUE INDEX IF NOT EXISTS fb_pages_ig_business_account_id_uidx
  ON public.fb_pages(ig_business_account_id)
  WHERE ig_business_account_id IS NOT NULL;
