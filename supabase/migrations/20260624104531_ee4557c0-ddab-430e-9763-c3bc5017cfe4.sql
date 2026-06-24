REVOKE SELECT ON public.fb_pages FROM authenticated;
REVOKE SELECT ON public.fb_pages FROM anon;

GRANT SELECT (
  id, user_id, fb_page_id, page_name, page_picture_url, page_category,
  is_active, subscription_status, subscription_error, subscribed_fields,
  ig_business_account_id, ig_username, ig_picture_url, ig_subscription_status,
  connected_at, last_sync_at, disconnected_at, pending_delete_at, created_at
) ON public.fb_pages TO authenticated;

GRANT ALL ON public.fb_pages TO service_role;