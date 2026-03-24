-- Admin can delete profiles (to remove users)
CREATE POLICY "Admins delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete user_credits
CREATE POLICY "Admins delete credits"
ON public.user_credits FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete credit_transactions
CREATE POLICY "Admins delete transactions"
ON public.credit_transactions FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete products
CREATE POLICY "Admins delete all products"
ON public.products FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete conversations
CREATE POLICY "Admins delete all conversations"
ON public.conversations FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete messages
CREATE POLICY "Admins delete all messages"
ON public.messages FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete auto_reply_rules
CREATE POLICY "Admins delete all auto_reply_rules"
ON public.auto_reply_rules FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete scheduled_messages
CREATE POLICY "Admins delete all scheduled_messages"
ON public.scheduled_messages FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete bot_settings
CREATE POLICY "Admins delete all bot_settings"
ON public.bot_settings FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete fb_pages
CREATE POLICY "Admins delete all fb_pages"
ON public.fb_pages FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));