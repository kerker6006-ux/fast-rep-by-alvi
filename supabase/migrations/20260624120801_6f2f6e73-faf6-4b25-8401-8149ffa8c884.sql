
-- =========================================================
-- Page Sharing: Team Members & Invites (uuid-keyed)
-- =========================================================

DO $$ BEGIN
  CREATE TYPE public.page_member_role AS ENUM ('full','moderator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.page_invite_status AS ENUM ('pending','accepted','revoked','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.page_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.fb_pages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.page_member_role NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(page_id, user_id)
);
CREATE INDEX IF NOT EXISTS page_members_user_idx ON public.page_members(user_id);
CREATE INDEX IF NOT EXISTS page_members_page_idx ON public.page_members(page_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_members TO authenticated;
GRANT ALL ON public.page_members TO service_role;

CREATE TABLE IF NOT EXISTS public.page_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.fb_pages(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.page_member_role NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.page_invite_status NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS page_invites_token_idx ON public.page_invites(token);
CREATE UNIQUE INDEX IF NOT EXISTS page_invites_pending_uniq ON public.page_invites(page_id, lower(email)) WHERE status = 'pending';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_invites TO authenticated;
GRANT ALL ON public.page_invites TO service_role;

-- Add fb_page_id (uuid FK) to tables that lacked it
ALTER TABLE public.conversations    ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.messages         ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.pending_products ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.product_suggestions ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.comment_trigger_logs ADD COLUMN IF NOT EXISTS fb_page_id_uuid uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;
ALTER TABLE public.notifications    ADD COLUMN IF NOT EXISTS fb_page_id uuid REFERENCES public.fb_pages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS conversations_fb_page_idx ON public.conversations(fb_page_id);
CREATE INDEX IF NOT EXISTS messages_fb_page_idx ON public.messages(fb_page_id);
CREATE INDEX IF NOT EXISTS notifications_fb_page_idx ON public.notifications(fb_page_id);

-- Helper functions (uuid keyed on fb_pages.id)
CREATE OR REPLACE FUNCTION public.user_page_role(_page_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _page_id IS NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM fb_pages p WHERE p.id = _page_id AND p.user_id = auth.uid()) THEN 'owner'
    ELSE (SELECT m.role::text FROM page_members m WHERE m.page_id = _page_id AND m.user_id = auth.uid() LIMIT 1)
  END
$$;

CREATE OR REPLACE FUNCTION public.user_has_page_access(_page_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _page_id IS NOT NULL AND public.user_page_role(_page_id) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_page(_page_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_page_role(_page_id) IN ('owner','full')
$$;

CREATE OR REPLACE FUNCTION public.user_owns_page(_page_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.user_page_role(_page_id) = 'owner'
$$;

-- text variant for comment_triggers (where fb_page_id is FB textual id)
CREATE OR REPLACE FUNCTION public.user_has_fb_page_access(_fb_page_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM fb_pages p WHERE p.fb_page_id = _fb_page_id
      AND (p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM page_members m WHERE m.page_id = p.id AND m.user_id = auth.uid()))
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_fb_page(_fb_page_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM fb_pages p WHERE p.fb_page_id = _fb_page_id
      AND (p.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM page_members m WHERE m.page_id = p.id AND m.user_id = auth.uid() AND m.role = 'full'))
  )
$$;

-- RLS on page_members & page_invites
ALTER TABLE public.page_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read accessible pages" ON public.page_members
  FOR SELECT USING (public.user_has_page_access(page_id));
CREATE POLICY "managers insert members" ON public.page_members
  FOR INSERT WITH CHECK (public.user_can_manage_page(page_id));
CREATE POLICY "managers update members" ON public.page_members
  FOR UPDATE USING (public.user_can_manage_page(page_id));
CREATE POLICY "managers delete members" ON public.page_members
  FOR DELETE USING (public.user_can_manage_page(page_id));

CREATE POLICY "managers read invites" ON public.page_invites
  FOR SELECT USING (public.user_can_manage_page(page_id));
CREATE POLICY "managers insert invites" ON public.page_invites
  FOR INSERT WITH CHECK (public.user_can_manage_page(page_id) AND invited_by = auth.uid());
CREATE POLICY "managers update invites" ON public.page_invites
  FOR UPDATE USING (public.user_can_manage_page(page_id));
CREATE POLICY "managers delete invites" ON public.page_invites
  FOR DELETE USING (public.user_can_manage_page(page_id));

-- fb_pages: members can SELECT; mutate stays owner-only
DROP POLICY IF EXISTS "Users manage own pages" ON public.fb_pages;
CREATE POLICY "Owner & members read pages" ON public.fb_pages
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM page_members m WHERE m.page_id = fb_pages.id AND m.user_id = auth.uid()
  ));
CREATE POLICY "Owner insert pages" ON public.fb_pages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner update pages" ON public.fb_pages
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner delete pages" ON public.fb_pages
  FOR DELETE USING (auth.uid() = user_id);

-- bot_settings
DROP POLICY IF EXISTS "Users read own settings" ON public.bot_settings;
DROP POLICY IF EXISTS "Users insert own settings" ON public.bot_settings;
DROP POLICY IF EXISTS "Users update own settings" ON public.bot_settings;
CREATE POLICY "members read bot_settings" ON public.bot_settings
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "managers ins bot_settings" ON public.bot_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));
CREATE POLICY "managers upd bot_settings" ON public.bot_settings
  FOR UPDATE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));

-- products
DROP POLICY IF EXISTS "Users read own products" ON public.products;
DROP POLICY IF EXISTS "Users insert own products" ON public.products;
DROP POLICY IF EXISTS "Users update own products" ON public.products;
DROP POLICY IF EXISTS "Users delete own products" ON public.products;
DROP POLICY IF EXISTS "Users manage own products" ON public.products;
CREATE POLICY "members read products" ON public.products
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "managers ins products" ON public.products
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));
CREATE POLICY "managers upd products" ON public.products
  FOR UPDATE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));
CREATE POLICY "managers del products" ON public.products
  FOR DELETE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));

-- services
DROP POLICY IF EXISTS "Users manage own services" ON public.services;
CREATE POLICY "members read services" ON public.services
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "managers ins services" ON public.services
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));
CREATE POLICY "managers upd services" ON public.services
  FOR UPDATE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));
CREATE POLICY "managers del services" ON public.services
  FOR DELETE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));

-- auto_reply_rules
DROP POLICY IF EXISTS "Users read own rules" ON public.auto_reply_rules;
DROP POLICY IF EXISTS "Users insert own rules" ON public.auto_reply_rules;
DROP POLICY IF EXISTS "Users update own rules" ON public.auto_reply_rules;
DROP POLICY IF EXISTS "Users delete own rules" ON public.auto_reply_rules;
CREATE POLICY "members read rules" ON public.auto_reply_rules
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "managers ins rules" ON public.auto_reply_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));
CREATE POLICY "managers upd rules" ON public.auto_reply_rules
  FOR UPDATE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));
CREATE POLICY "managers del rules" ON public.auto_reply_rules
  FOR DELETE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));

-- comment_triggers (text fb_page_id)
DROP POLICY IF EXISTS "Users manage own comment_triggers" ON public.comment_triggers;
CREATE POLICY "members read comment_triggers" ON public.comment_triggers
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_fb_page_access(fb_page_id));
CREATE POLICY "managers manage comment_triggers" ON public.comment_triggers
  FOR ALL USING (auth.uid() = user_id OR public.user_can_manage_fb_page(fb_page_id))
  WITH CHECK (auth.uid() = user_id OR public.user_can_manage_fb_page(fb_page_id));

-- scheduled_messages
DROP POLICY IF EXISTS "Users select own scheduled_messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users insert own scheduled_messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users update own scheduled_messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users delete own scheduled_messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Users manage own scheduled_messages" ON public.scheduled_messages;
CREATE POLICY "members read scheduled" ON public.scheduled_messages
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "managers ins scheduled" ON public.scheduled_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));
CREATE POLICY "managers upd scheduled" ON public.scheduled_messages
  FOR UPDATE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));
CREATE POLICY "managers del scheduled" ON public.scheduled_messages
  FOR DELETE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));

-- website_knowledge
DROP POLICY IF EXISTS "Users manage own website_knowledge" ON public.website_knowledge;
CREATE POLICY "members read knowledge" ON public.website_knowledge
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "managers manage knowledge" ON public.website_knowledge
  FOR ALL USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id))
  WITH CHECK (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));

-- training_suggestions
DROP POLICY IF EXISTS "Users manage own training_suggestions" ON public.training_suggestions;
CREATE POLICY "members read training" ON public.training_suggestions
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "managers manage training" ON public.training_suggestions
  FOR ALL USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id))
  WITH CHECK (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));

-- conversations (new fb_page_id uuid)
DROP POLICY IF EXISTS "Users read own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users insert own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users update own conversations" ON public.conversations;
CREATE POLICY "members read conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "members ins conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "members upd conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));

-- messages
DROP POLICY IF EXISTS "Users read own messages" ON public.messages;
DROP POLICY IF EXISTS "Users insert own messages" ON public.messages;
CREATE POLICY "members read messages" ON public.messages
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "members ins messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "members upd messages" ON public.messages
  FOR UPDATE USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));

-- orders
DROP POLICY IF EXISTS "Users read own orders" ON public.orders;
DROP POLICY IF EXISTS "Users insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users update own orders" ON public.orders;
DROP POLICY IF EXISTS "Users delete own orders" ON public.orders;
CREATE POLICY "members read orders" ON public.orders
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "members ins orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "members upd orders" ON public.orders
  FOR UPDATE USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "managers del orders" ON public.orders
  FOR DELETE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));

-- complaints
DROP POLICY IF EXISTS "Users read own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users insert own complaints" ON public.complaints;
DROP POLICY IF EXISTS "Users update own complaints" ON public.complaints;
CREATE POLICY "members read complaints" ON public.complaints
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "members ins complaints" ON public.complaints
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "members upd complaints" ON public.complaints
  FOR UPDATE USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));

-- leads
DROP POLICY IF EXISTS "Users manage own leads" ON public.leads;
CREATE POLICY "members manage leads" ON public.leads
  FOR ALL USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id))
  WITH CHECK (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));

-- pending_products / product_suggestions
DROP POLICY IF EXISTS "Users select own pending_products" ON public.pending_products;
DROP POLICY IF EXISTS "Users update own pending_products" ON public.pending_products;
DROP POLICY IF EXISTS "Users delete own pending_products" ON public.pending_products;
CREATE POLICY "members read pending" ON public.pending_products
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "managers upd pending" ON public.pending_products
  FOR UPDATE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));
CREATE POLICY "managers del pending" ON public.pending_products
  FOR DELETE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));

DROP POLICY IF EXISTS "Users select own product_suggestions" ON public.product_suggestions;
DROP POLICY IF EXISTS "Users update own product_suggestions" ON public.product_suggestions;
DROP POLICY IF EXISTS "Users delete own product_suggestions" ON public.product_suggestions;
CREATE POLICY "members read suggestions" ON public.product_suggestions
  FOR SELECT USING (auth.uid() = user_id OR public.user_has_page_access(fb_page_id));
CREATE POLICY "managers upd suggestions" ON public.product_suggestions
  FOR UPDATE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));
CREATE POLICY "managers del suggestions" ON public.product_suggestions
  FOR DELETE USING (auth.uid() = user_id OR public.user_can_manage_page(fb_page_id));

-- notifications: per-user (one row per recipient); RLS unchanged

-- Trigger functions: fan out to members
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec_user uuid;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link, metadata, fb_page_id)
  VALUES (NEW.user_id, 'order', 'New order received',
          COALESCE(NEW.customer_name,'Customer') || ' placed an order',
          '#orders', jsonb_build_object('order_id', NEW.id), NEW.fb_page_id);
  IF NEW.fb_page_id IS NOT NULL THEN
    FOR rec_user IN
      SELECT m.user_id FROM page_members m WHERE m.page_id = NEW.fb_page_id AND m.user_id <> NEW.user_id
    LOOP
      INSERT INTO notifications (user_id, type, title, body, link, metadata, fb_page_id)
      VALUES (rec_user, 'order', 'New order received',
              COALESCE(NEW.customer_name,'Customer') || ' placed an order',
              '#orders', jsonb_build_object('order_id', NEW.id), NEW.fb_page_id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_new_complaint()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec_user uuid;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link, metadata, fb_page_id)
  VALUES (NEW.user_id, 'appointment', 'New callback request',
          COALESCE(NEW.customer_name,'Customer') || ' needs a callback',
          '#complaints', jsonb_build_object('complaint_id', NEW.id), NEW.fb_page_id);
  IF NEW.fb_page_id IS NOT NULL THEN
    FOR rec_user IN
      SELECT m.user_id FROM page_members m WHERE m.page_id = NEW.fb_page_id AND m.user_id <> NEW.user_id
    LOOP
      INSERT INTO notifications (user_id, type, title, body, link, metadata, fb_page_id)
      VALUES (rec_user, 'appointment', 'New callback request',
              COALESCE(NEW.customer_name,'Customer') || ' needs a callback',
              '#complaints', jsonb_build_object('complaint_id', NEW.id), NEW.fb_page_id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
