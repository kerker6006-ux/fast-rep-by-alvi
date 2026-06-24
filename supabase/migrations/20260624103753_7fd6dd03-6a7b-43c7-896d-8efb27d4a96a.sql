
-- 1) fb_pages: revoke client-side SELECT on sensitive token columns
REVOKE SELECT (page_access_token, verify_token) ON public.fb_pages FROM authenticated;
REVOKE SELECT (page_access_token, verify_token) ON public.fb_pages FROM anon;

-- 2) data_deletion_requests: keep public lookup-by-code but hide sensitive fields
-- Grant column-level SELECT only on safe columns to anon/authenticated.
REVOKE SELECT ON public.data_deletion_requests FROM anon;
REVOKE SELECT ON public.data_deletion_requests FROM authenticated;
GRANT SELECT (confirmation_code, status, created_at, completed_at) ON public.data_deletion_requests TO anon;
GRANT SELECT (confirmation_code, status, created_at, completed_at) ON public.data_deletion_requests TO authenticated;
