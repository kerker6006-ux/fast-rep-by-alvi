
-- 1. Allow authenticated users to insert their own complaints
CREATE POLICY "Users insert own complaints" ON public.complaints
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. Remove admin direct SELECT on fb_pages (tokens leak). Admins must use fb_pages_safe view.
DROP POLICY IF EXISTS "Admins read all fb_pages" ON public.fb_pages;

-- 3. Remove orders & scheduled_messages from realtime publication to prevent cross-tenant leaks
ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
ALTER PUBLICATION supabase_realtime DROP TABLE public.scheduled_messages;

-- 4. Restrict product-images uploads to the user's own folder
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
