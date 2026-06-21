
-- 1) fb_pages: revoke broad SELECT, keep RLS for write ops, expose only safe view
REVOKE SELECT ON public.fb_pages FROM authenticated, anon;
GRANT SELECT ON public.fb_pages_safe TO authenticated;

-- 2) Storage product-images: simplify SELECT policy to bucket scope only
DROP POLICY IF EXISTS "Public can read individual product images" ON storage.objects;
CREATE POLICY "Public can read individual product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images' AND name ~ '\.(png|jpg|jpeg|webp|gif|svg)$');

-- 3) Realtime authorization for notifications channel
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notification realtime messages" ON realtime.messages;
CREATE POLICY "Users read own notification realtime messages"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (
    (realtime.topic() = 'notifications:' || auth.uid()::text)
    OR (extension = 'postgres_changes' AND topic LIKE 'notifications:' || auth.uid()::text || '%')
  );

-- 4) Pin search_path on pgmq helper functions
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
