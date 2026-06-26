-- ============================================================
-- LeadPilot: Add Broadcast feature, remove Scheduled Messages
-- ============================================================

-- Create broadcasts table
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fb_page_id uuid NOT NULL REFERENCES public.fb_pages(id) ON DELETE CASCADE,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'done', 'failed')),
  total_recipients integer,
  sent_count integer,
  failed_count integer,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for broadcasts
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own broadcasts"
  ON public.broadcasts FOR ALL
  USING (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_broadcasts_user_page ON public.broadcasts (user_id, fb_page_id, created_at DESC);

-- Cancel any pending scheduled messages (cleanup)
UPDATE public.scheduled_messages SET status = 'cancelled' WHERE status = 'pending';
