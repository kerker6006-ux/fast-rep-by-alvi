
CREATE TABLE public.training_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('faq','rule','personality','example','never_say')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','rejected')),
  source text NOT NULL DEFAULT 'auto' CHECK (source IN ('auto','chat')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_suggestions TO authenticated;
GRANT ALL ON public.training_suggestions TO service_role;

ALTER TABLE public.training_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own suggestions"
ON public.training_suggestions FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX training_suggestions_user_status_idx
  ON public.training_suggestions(user_id, status, created_at DESC);

CREATE TRIGGER update_training_suggestions_updated_at
  BEFORE UPDATE ON public.training_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
