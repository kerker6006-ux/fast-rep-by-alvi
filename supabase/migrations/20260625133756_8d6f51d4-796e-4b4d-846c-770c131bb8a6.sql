-- Remove blocking unique constraint that prevented per-page settings
-- and migrate legacy NULL fb_page_id rows so the existing partial unique
-- index on (fb_page_id, setting_key) can be the sole conflict target.

DROP INDEX IF EXISTS public.bot_settings_user_key;

-- Drop legacy chat history rows with NULL fb_page_id so they don't
-- collide with per-page inserts via the (user_id, setting_key) path.
DELETE FROM public.bot_settings
WHERE setting_key = 'ai_training_chat_history' AND fb_page_id IS NULL;

-- Add a unique index for user-scoped (no page) settings only, so generic
-- non-page settings can still upsert without conflicting with per-page rows.
CREATE UNIQUE INDEX IF NOT EXISTS bot_settings_user_only_key
  ON public.bot_settings (user_id, setting_key)
  WHERE fb_page_id IS NULL;