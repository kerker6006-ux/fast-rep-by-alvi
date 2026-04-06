
CREATE TABLE public.pending_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  fb_post_id TEXT,
  image_url TEXT,
  ai_name TEXT,
  ai_name_bn TEXT,
  ai_description TEXT,
  ai_description_bn TEXT,
  ai_category TEXT,
  ai_color TEXT,
  ai_price NUMERIC DEFAULT 0,
  ai_material TEXT,
  ai_keywords TEXT[] DEFAULT '{}',
  post_caption TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own pending_products" ON public.pending_products
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users update own pending_products" ON public.pending_products
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users delete own pending_products" ON public.pending_products
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own pending_products" ON public.pending_products
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role insert pending_products" ON public.pending_products
  FOR INSERT TO service_role WITH CHECK (true);
