-- ============================================================
-- LeadPilot Bug Fix Batch 1
-- Fixes: duplicate bot_settings, unique constraint, leads fb_page_id
-- ============================================================

-- Bug #1 fix: Remove duplicate bot_settings rows (keep latest per user+page+key)
DELETE FROM bot_settings
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, fb_page_id, setting_key) id
  FROM bot_settings
  ORDER BY user_id, fb_page_id, setting_key, updated_at DESC NULLS LAST
);

-- Bug #1 fix: Add unique constraint to prevent duplicates forever
-- Drop if exists first to avoid errors on re-run
ALTER TABLE bot_settings DROP CONSTRAINT IF EXISTS bot_settings_user_page_key_unique;
ALTER TABLE bot_settings ADD CONSTRAINT bot_settings_user_page_key_unique
  UNIQUE (user_id, fb_page_id, setting_key);

-- Bug #5 fix: Populate fb_page_id on leads that are missing it
-- Match via conversation -> fb_pages
UPDATE leads l
SET fb_page_id = c.fb_page_id
FROM conversations c
WHERE l.conversation_id = c.id
  AND l.fb_page_id IS NULL
  AND c.fb_page_id IS NOT NULL;

-- Bug #27 fix: Normalize any leads with status 'confirmed' that somehow got
-- stored without confirmed_at — backfill confirmed_at from updated_at
UPDATE leads
SET confirmed_at = updated_at
WHERE status = 'confirmed'
  AND confirmed_at IS NULL;

-- Add index for rate limiting query performance (Bug #34)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_direction_created
  ON messages (conversation_id, direction, created_at DESC);

-- Add index for faster conversation alerts query
CREATE INDEX IF NOT EXISTS idx_conversations_needs_human
  ON conversations (user_id, needs_human)
  WHERE needs_human = true;
