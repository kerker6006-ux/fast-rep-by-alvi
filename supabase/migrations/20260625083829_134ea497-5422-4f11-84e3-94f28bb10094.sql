
DROP POLICY IF EXISTS "Anyone can look up status by confirmation code" ON public.data_deletion_requests;

CREATE OR REPLACE FUNCTION public.get_data_deletion_status(_code text)
RETURNS TABLE(status text, created_at timestamptz, completed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status::text, created_at, completed_at
  FROM public.data_deletion_requests
  WHERE confirmation_code = _code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_data_deletion_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_data_deletion_status(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Owner & members read pages" ON public.fb_pages;

CREATE POLICY "Owners read own pages"
ON public.fb_pages
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP VIEW IF EXISTS public.fb_pages_safe;
CREATE VIEW public.fb_pages_safe
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  p.id, p.user_id, p.fb_page_id, p.page_name, p.page_picture_url, p.page_category,
  p.is_active, p.subscription_status, p.subscription_error,
  p.ig_business_account_id, p.ig_username, p.ig_picture_url, p.ig_subscription_status,
  p.subscribed_fields, p.connected_at, p.last_sync_at, p.disconnected_at,
  p.pending_delete_at, p.created_at
FROM public.fb_pages p
WHERE auth.uid() = p.user_id
   OR EXISTS (
     SELECT 1 FROM public.page_members m
     WHERE m.page_id = p.id AND m.user_id = auth.uid()
   )
   OR public.has_role(auth.uid(), 'admin');

REVOKE ALL ON public.fb_pages_safe FROM PUBLIC, anon;
GRANT SELECT ON public.fb_pages_safe TO authenticated;

DROP POLICY IF EXISTS "Admins read all trigger logs" ON public.comment_trigger_logs;
DROP POLICY IF EXISTS "Users read own trigger logs" ON public.comment_trigger_logs;

CREATE POLICY "Admins read all trigger logs"
ON public.comment_trigger_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own trigger logs"
ON public.comment_trigger_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
