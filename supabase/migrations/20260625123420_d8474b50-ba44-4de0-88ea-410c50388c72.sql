CREATE TABLE public.wizard_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fb_page_id uuid NOT NULL UNIQUE,
  analysis jsonb NOT NULL DEFAULT '{}'::jsonb,
  messages_scanned integer NOT NULL DEFAULT 0,
  conversations_scanned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wizard_analysis TO authenticated;
GRANT ALL ON public.wizard_analysis TO service_role;

ALTER TABLE public.wizard_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read wizard_analysis"
  ON public.wizard_analysis FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));

CREATE POLICY "managers insert wizard_analysis"
  ON public.wizard_analysis FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));

CREATE POLICY "managers update wizard_analysis"
  ON public.wizard_analysis FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));

CREATE POLICY "managers delete wizard_analysis"
  ON public.wizard_analysis FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));

CREATE TRIGGER wizard_analysis_set_updated_at
  BEFORE UPDATE ON public.wizard_analysis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();