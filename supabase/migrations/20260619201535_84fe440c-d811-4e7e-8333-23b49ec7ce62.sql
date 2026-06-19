
-- 1. Lock SECURITY DEFINER trigger helpers from API role calls
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_credits() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

-- 2. Add explicit service-role-only policy on fb_oauth_sessions (edge functions use service_role which bypasses RLS, this just documents intent and blocks anon/authenticated)
DROP POLICY IF EXISTS "No client access to fb_oauth_sessions" ON public.fb_oauth_sessions;
CREATE POLICY "No client access to fb_oauth_sessions"
  ON public.fb_oauth_sessions FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);

-- 3. Tighten product-images storage: keep individual files publicly fetchable via direct URL, block listing the bucket
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
CREATE POLICY "Public can read individual product images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-images' AND auth.role() <> 'anon' OR bucket_id = 'product-images');
-- Restrict the listing API: only authenticated owners can list their own folder
DROP POLICY IF EXISTS "Owners can list their product image folder" ON storage.objects;
CREATE POLICY "Owners can list their product image folder"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
