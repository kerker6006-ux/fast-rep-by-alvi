ALTER TABLE public.profiles ALTER COLUMN is_approved SET DEFAULT true;
UPDATE public.profiles SET is_approved = true WHERE is_approved = false OR is_approved IS NULL;