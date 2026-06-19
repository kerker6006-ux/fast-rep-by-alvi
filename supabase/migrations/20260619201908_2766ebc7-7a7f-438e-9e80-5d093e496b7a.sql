
DROP POLICY IF EXISTS "anyone read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated can read settings" ON public.app_settings;
CREATE POLICY "Authenticated can read settings"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Only admins can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Only admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Users insert own conversations" ON public.conversations;
CREATE POLICY "Users insert own conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Owners update their product images" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete their product images" ON storage.objects;
CREATE POLICY "Owners update their product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'product-images' AND owner = auth.uid());
CREATE POLICY "Owners delete their product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND owner = auth.uid());

CREATE OR REPLACE VIEW public.fb_pages_safe
WITH (security_invoker = on) AS
SELECT
  id, user_id, fb_page_id, ig_business_account_id,
  page_name, is_active, created_at, connected_at, last_sync_at,
  page_picture_url, ig_username, ig_picture_url,
  subscription_status, subscription_error, ig_subscription_status,
  subscribed_fields, disconnected_at
FROM public.fb_pages;
GRANT SELECT ON public.fb_pages_safe TO authenticated;
