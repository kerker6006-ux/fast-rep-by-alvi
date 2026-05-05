
CREATE TABLE public.website_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_url TEXT NOT NULL,
  page_url TEXT NOT NULL,
  title TEXT,
  content TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_website_knowledge_user ON public.website_knowledge(user_id);
CREATE UNIQUE INDEX idx_website_knowledge_user_page ON public.website_knowledge(user_id, page_url);

ALTER TABLE public.website_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own website_knowledge" ON public.website_knowledge
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all website_knowledge" ON public.website_knowledge
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_website_knowledge_updated_at
  BEFORE UPDATE ON public.website_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
