
WITH single_page AS (
  SELECT user_id, (array_agg(id))[1] AS page_id
  FROM public.fb_pages GROUP BY user_id HAVING COUNT(*) = 1
)
UPDATE public.bot_settings b SET fb_page_id = sp.page_id
FROM single_page sp WHERE b.user_id = sp.user_id AND b.fb_page_id IS NULL;

WITH single_page AS (
  SELECT user_id, (array_agg(id))[1] AS page_id FROM public.fb_pages GROUP BY user_id HAVING COUNT(*) = 1
)
UPDATE public.training_suggestions t SET fb_page_id = sp.page_id
FROM single_page sp WHERE t.user_id = sp.user_id AND t.fb_page_id IS NULL;

WITH single_page AS (
  SELECT user_id, (array_agg(id))[1] AS page_id FROM public.fb_pages GROUP BY user_id HAVING COUNT(*) = 1
)
UPDATE public.pending_products t SET fb_page_id = sp.page_id
FROM single_page sp WHERE t.user_id = sp.user_id AND t.fb_page_id IS NULL;

WITH single_page AS (
  SELECT user_id, (array_agg(id))[1] AS page_id FROM public.fb_pages GROUP BY user_id HAVING COUNT(*) = 1
)
UPDATE public.product_suggestions t SET fb_page_id = sp.page_id
FROM single_page sp WHERE t.user_id = sp.user_id AND t.fb_page_id IS NULL;

UPDATE public.conversations c
SET fb_page_id = p.id
FROM public.fb_pages p
WHERE c.fb_page_id IS NULL AND p.user_id = c.user_id;

UPDATE public.messages m
SET fb_page_id = c.fb_page_id
FROM public.conversations c
WHERE m.fb_page_id IS NULL AND m.conversation_id = c.id AND c.fb_page_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bot_settings_page_key
  ON public.bot_settings (fb_page_id, setting_key)
  WHERE fb_page_id IS NOT NULL;
