
-- Fix SECURITY DEFINER view: switch fb_pages_safe to security_invoker
-- Grant column-level access on fb_pages so the invoker can read non-secret columns
-- and add SELECT policies for members and admins (owners already covered).

ALTER VIEW public.fb_pages_safe SET (security_invoker = true, security_barrier = true);

-- Column-level grants: every column EXCEPT the secret tokens
GRANT SELECT (
  id, user_id, fb_page_id, page_name, page_picture_url, page_category,
  is_active, subscription_status, subscription_error,
  ig_business_account_id, ig_username, ig_picture_url, ig_subscription_status,
  subscribed_fields, connected_at, last_sync_at, disconnected_at,
  pending_delete_at, created_at
) ON public.fb_pages TO authenticated;
GRANT ALL ON public.fb_pages TO service_role;

-- Additional SELECT policies for members and admins (owners already have one)
DROP POLICY IF EXISTS "Members read pages" ON public.fb_pages;
CREATE POLICY "Members read pages" ON public.fb_pages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.page_members m WHERE m.page_id = fb_pages.id AND m.user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins read pages" ON public.fb_pages;
CREATE POLICY "Admins read pages" ON public.fb_pages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Fix mutable search_path on email queue helper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
