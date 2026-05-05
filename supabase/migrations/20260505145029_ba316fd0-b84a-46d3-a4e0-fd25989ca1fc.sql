
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS needs_human BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_needs_human
  ON public.conversations (user_id, needs_human) WHERE needs_human = true;

DROP POLICY IF EXISTS "Users update own conversations" ON public.conversations;
CREATE POLICY "Users update own conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
