
-- Allow public insert/update/delete on products (no auth required for this admin dashboard)
CREATE POLICY "Anyone can insert products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update products" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete products" ON public.products FOR DELETE USING (true);

-- Also fix bot_settings - allow upsert without auth
CREATE POLICY "Anyone can insert settings" ON public.bot_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update settings" ON public.bot_settings FOR UPDATE USING (true);

-- Fix auto_reply_rules for non-auth users
CREATE POLICY "Anyone can insert rules" ON public.auto_reply_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rules" ON public.auto_reply_rules FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete rules" ON public.auto_reply_rules FOR DELETE USING (true);

-- Fix scheduled_messages delete
CREATE POLICY "Anyone can delete scheduled" ON public.scheduled_messages FOR DELETE USING (true);

-- Fix orders delete
CREATE POLICY "Anyone can delete orders" ON public.orders FOR DELETE USING (true);

-- Add unique constraint on bot_settings.setting_key for upsert
ALTER TABLE public.bot_settings ADD CONSTRAINT bot_settings_setting_key_unique UNIQUE (setting_key);
