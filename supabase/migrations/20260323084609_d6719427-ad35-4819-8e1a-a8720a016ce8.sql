
-- Create app_role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Create fb_pages table for multi-tenant FB page routing
CREATE TABLE public.fb_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fb_page_id text NOT NULL UNIQUE,
  page_name text,
  page_access_token text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.fb_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pages" ON public.fb_pages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add user_id to all tenant tables
ALTER TABLE public.products ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.bot_settings ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.auto_reply_rules ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.scheduled_messages ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop ALL old RLS policies
DROP POLICY IF EXISTS "Anyone can read active products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can manage products" ON public.products;
DROP POLICY IF EXISTS "Auth users can insert products" ON public.products;
DROP POLICY IF EXISTS "Auth users can update products" ON public.products;
DROP POLICY IF EXISTS "Auth users can delete products" ON public.products;

DROP POLICY IF EXISTS "Authenticated users can manage settings" ON public.bot_settings;
DROP POLICY IF EXISTS "Service can read settings" ON public.bot_settings;
DROP POLICY IF EXISTS "Auth users can insert settings" ON public.bot_settings;
DROP POLICY IF EXISTS "Auth users can update settings" ON public.bot_settings;

DROP POLICY IF EXISTS "Anyone can read orders" ON public.orders;
DROP POLICY IF EXISTS "Service can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Service can update orders" ON public.orders;
DROP POLICY IF EXISTS "Auth users can delete orders" ON public.orders;

DROP POLICY IF EXISTS "Authenticated users can read conversations" ON public.conversations;
DROP POLICY IF EXISTS "Service role can manage conversations" ON public.conversations;
DROP POLICY IF EXISTS "Service role can update conversations" ON public.conversations;

DROP POLICY IF EXISTS "Authenticated users can read messages" ON public.messages;
DROP POLICY IF EXISTS "Service role can insert messages" ON public.messages;

DROP POLICY IF EXISTS "Anyone can read rules" ON public.auto_reply_rules;
DROP POLICY IF EXISTS "Authenticated can manage rules" ON public.auto_reply_rules;
DROP POLICY IF EXISTS "Auth users can insert rules" ON public.auto_reply_rules;
DROP POLICY IF EXISTS "Auth users can update rules" ON public.auto_reply_rules;
DROP POLICY IF EXISTS "Auth users can delete rules" ON public.auto_reply_rules;

DROP POLICY IF EXISTS "Anyone can read scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Service can insert scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Service can update scheduled messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Auth users can delete scheduled" ON public.scheduled_messages;

-- New tenant-isolated RLS policies
-- Products
CREATE POLICY "Users read own products" ON public.products FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own products" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own products" ON public.products FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own products" ON public.products FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all products" ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- bot_settings
CREATE POLICY "Users read own settings" ON public.bot_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own settings" ON public.bot_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own settings" ON public.bot_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- orders
CREATE POLICY "Users read own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own orders" ON public.orders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own orders" ON public.orders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- conversations
CREATE POLICY "Users read own conversations" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- messages
CREATE POLICY "Users read own messages" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- auto_reply_rules
CREATE POLICY "Users read own rules" ON public.auto_reply_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own rules" ON public.auto_reply_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own rules" ON public.auto_reply_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own rules" ON public.auto_reply_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- scheduled_messages
CREATE POLICY "Users read own scheduled" ON public.scheduled_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own scheduled" ON public.scheduled_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own scheduled" ON public.scheduled_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own scheduled" ON public.scheduled_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Admin policies for admin panel
CREATE POLICY "Admins read all orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all conversations" ON public.conversations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read all fb_pages" ON public.fb_pages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Update bot_settings unique constraint to be per-user
ALTER TABLE public.bot_settings DROP CONSTRAINT IF EXISTS bot_settings_setting_key_key;
CREATE UNIQUE INDEX bot_settings_user_key ON public.bot_settings(user_id, setting_key);
