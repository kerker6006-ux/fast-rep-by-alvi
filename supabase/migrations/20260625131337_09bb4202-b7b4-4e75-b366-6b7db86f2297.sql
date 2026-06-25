ALTER TABLE public.services ALTER COLUMN category DROP NOT NULL;
ALTER TABLE public.services ALTER COLUMN category TYPE text USING category::text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.pending_products ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'product';
ALTER TABLE public.pending_products ADD CONSTRAINT pending_products_kind_check CHECK (kind IN ('product','service'));
ALTER TABLE public.pending_products ADD COLUMN IF NOT EXISTS ai_price_text text;
ALTER TABLE public.pending_products ADD COLUMN IF NOT EXISTS ai_duration_text text;