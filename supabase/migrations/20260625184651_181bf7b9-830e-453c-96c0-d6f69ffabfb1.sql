ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS preferred_time text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;