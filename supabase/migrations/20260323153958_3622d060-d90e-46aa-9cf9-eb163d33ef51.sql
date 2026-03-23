ALTER TABLE public.fb_pages ADD COLUMN verify_token text NOT NULL DEFAULT 'fb_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16);

-- Update existing rows to have unique tokens
UPDATE public.fb_pages SET verify_token = 'fb_' || substr(md5(random()::text || id::text), 1, 16);