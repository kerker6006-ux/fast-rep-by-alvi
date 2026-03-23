
-- Tighten products: require auth for write operations
DROP POLICY IF EXISTS "Anyone can insert products" ON public.products;
DROP POLICY IF EXISTS "Anyone can update products" ON public.products;
DROP POLICY IF EXISTS "Anyone can delete products" ON public.products;

CREATE POLICY "Auth users can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete products" ON public.products FOR DELETE TO authenticated USING (true);

-- Tighten bot_settings
DROP POLICY IF EXISTS "Anyone can insert settings" ON public.bot_settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON public.bot_settings;

CREATE POLICY "Auth users can insert settings" ON public.bot_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update settings" ON public.bot_settings FOR UPDATE TO authenticated USING (true);

-- Tighten auto_reply_rules
DROP POLICY IF EXISTS "Anyone can insert rules" ON public.auto_reply_rules;
DROP POLICY IF EXISTS "Anyone can update rules" ON public.auto_reply_rules;
DROP POLICY IF EXISTS "Anyone can delete rules" ON public.auto_reply_rules;

CREATE POLICY "Auth users can insert rules" ON public.auto_reply_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update rules" ON public.auto_reply_rules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete rules" ON public.auto_reply_rules FOR DELETE TO authenticated USING (true);

-- Tighten orders
DROP POLICY IF EXISTS "Anyone can delete orders" ON public.orders;
CREATE POLICY "Auth users can delete orders" ON public.orders FOR DELETE TO authenticated USING (true);

-- Tighten scheduled_messages
DROP POLICY IF EXISTS "Anyone can delete scheduled" ON public.scheduled_messages;
CREATE POLICY "Auth users can delete scheduled" ON public.scheduled_messages FOR DELETE TO authenticated USING (true);
