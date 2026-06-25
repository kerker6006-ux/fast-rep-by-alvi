-- Make per-page bot setting upserts work with PostgREST/Supabase client.
-- Partial unique indexes cannot be targeted by ON CONFLICT (fb_page_id, setting_key),
-- so replace it with a normal unique index. NULL page rows remain allowed because
-- Postgres unique indexes treat NULL values as distinct.

DROP INDEX IF EXISTS public.bot_settings_page_key;

CREATE UNIQUE INDEX IF NOT EXISTS bot_settings_page_key
  ON public.bot_settings (fb_page_id, setting_key);