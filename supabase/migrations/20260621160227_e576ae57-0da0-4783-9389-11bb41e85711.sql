
DO $$ BEGIN
  CREATE TYPE public.page_category AS ENUM ('ecommerce', 'service', 'content_creator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.fb_pages
  ADD COLUMN IF NOT EXISTS page_category public.page_category,
  ADD COLUMN IF NOT EXISTS pending_delete_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_fb_pages_user_pending ON public.fb_pages(user_id, pending_delete_at);

ALTER TABLE public.products              ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.services              ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.orders                ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.complaints            ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.leads                 ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.auto_reply_rules      ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.bot_settings          ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.scheduled_messages    ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.comment_triggers      ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.website_knowledge     ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.training_suggestions  ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_products_page    ON public.products(fb_page_id);
CREATE INDEX IF NOT EXISTS idx_services_page    ON public.services(fb_page_id);
CREATE INDEX IF NOT EXISTS idx_orders_page      ON public.orders(fb_page_id);
CREATE INDEX IF NOT EXISTS idx_complaints_page  ON public.complaints(fb_page_id);
CREATE INDEX IF NOT EXISTS idx_leads_page       ON public.leads(fb_page_id);
CREATE INDEX IF NOT EXISTS idx_arr_page         ON public.auto_reply_rules(fb_page_id);
CREATE INDEX IF NOT EXISTS idx_bot_settings_page ON public.bot_settings(fb_page_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_page   ON public.scheduled_messages(fb_page_id);
CREATE INDEX IF NOT EXISTS idx_ct_page          ON public.comment_triggers(fb_page_id);
CREATE INDEX IF NOT EXISTS idx_wk_page          ON public.website_knowledge(fb_page_id);
CREATE INDEX IF NOT EXISTS idx_ts_page          ON public.training_suggestions(fb_page_id);

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.fb_pages WHERE is_active = true LOOP
    UPDATE public.products             SET fb_page_id = (SELECT id FROM public.fb_pages WHERE user_id = r.user_id AND is_active ORDER BY created_at LIMIT 1) WHERE user_id = r.user_id AND fb_page_id IS NULL;
    UPDATE public.services             SET fb_page_id = (SELECT id FROM public.fb_pages WHERE user_id = r.user_id AND is_active ORDER BY created_at LIMIT 1) WHERE user_id = r.user_id AND fb_page_id IS NULL;
    UPDATE public.orders               SET fb_page_id = (SELECT id FROM public.fb_pages WHERE user_id = r.user_id AND is_active ORDER BY created_at LIMIT 1) WHERE user_id = r.user_id AND fb_page_id IS NULL;
    UPDATE public.complaints           SET fb_page_id = (SELECT id FROM public.fb_pages WHERE user_id = r.user_id AND is_active ORDER BY created_at LIMIT 1) WHERE user_id = r.user_id AND fb_page_id IS NULL;
    UPDATE public.leads                SET fb_page_id = (SELECT id FROM public.fb_pages WHERE user_id = r.user_id AND is_active ORDER BY created_at LIMIT 1) WHERE user_id = r.user_id AND fb_page_id IS NULL;
    UPDATE public.auto_reply_rules     SET fb_page_id = (SELECT id FROM public.fb_pages WHERE user_id = r.user_id AND is_active ORDER BY created_at LIMIT 1) WHERE user_id = r.user_id AND fb_page_id IS NULL;
    UPDATE public.bot_settings         SET fb_page_id = (SELECT id FROM public.fb_pages WHERE user_id = r.user_id AND is_active ORDER BY created_at LIMIT 1) WHERE user_id = r.user_id AND fb_page_id IS NULL;
    UPDATE public.scheduled_messages   SET fb_page_id = (SELECT id FROM public.fb_pages WHERE user_id = r.user_id AND is_active ORDER BY created_at LIMIT 1) WHERE user_id = r.user_id AND fb_page_id IS NULL;
    UPDATE public.comment_triggers     SET fb_page_id = (SELECT id FROM public.fb_pages WHERE user_id = r.user_id AND is_active ORDER BY created_at LIMIT 1) WHERE user_id = r.user_id AND fb_page_id IS NULL;
    UPDATE public.website_knowledge    SET fb_page_id = (SELECT id FROM public.fb_pages WHERE user_id = r.user_id AND is_active ORDER BY created_at LIMIT 1) WHERE user_id = r.user_id AND fb_page_id IS NULL;
    UPDATE public.training_suggestions SET fb_page_id = (SELECT id FROM public.fb_pages WHERE user_id = r.user_id AND is_active ORDER BY created_at LIMIT 1) WHERE user_id = r.user_id AND fb_page_id IS NULL;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fb_page_id uuid NOT NULL REFERENCES public.fb_pages(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BDT',
  thumbnail_url text,
  payment_instructions text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own courses" ON public.courses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all courses" ON public.courses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_courses_page ON public.courses(fb_page_id);
CREATE INDEX idx_courses_user ON public.courses(user_id);
CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.course_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  video_url text,
  pdf_url text,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_lessons TO authenticated;
GRANT ALL ON public.course_lessons TO service_role;
ALTER TABLE public.course_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own lessons" ON public.course_lessons FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_lessons_course ON public.course_lessons(course_id, order_index);
CREATE TRIGGER update_course_lessons_updated_at BEFORE UPDATE ON public.course_lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  fb_user_id text,
  customer_name text,
  customer_phone text,
  payment_status text NOT NULL DEFAULT 'pending',
  amount_paid numeric,
  notes text,
  granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_enrollments TO authenticated;
GRANT ALL ON public.course_enrollments TO service_role;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own enrollments" ON public.course_enrollments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all enrollments" ON public.course_enrollments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_enrollments_course ON public.course_enrollments(course_id);
CREATE INDEX idx_enrollments_page ON public.course_enrollments(fb_page_id);
CREATE TRIGGER update_course_enrollments_updated_at BEFORE UPDATE ON public.course_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
