
-- Business category enum
CREATE TYPE public.business_category AS ENUM ('ecommerce','dental','hvac','salon');

-- Add category + business_info jsonb to profiles
ALTER TABLE public.profiles
  ADD COLUMN business_category public.business_category,
  ADD COLUMN business_info jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Services table (used by dental/hvac/salon, optionally ecommerce add-ons)
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.business_category NOT NULL,
  name text NOT NULL,
  description text,
  price_text text,
  duration_text text,
  service_area text,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own services" ON public.services
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_services_user_category ON public.services(user_id, category);

-- Leads table
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category public.business_category NOT NULL,
  name text,
  phone text,
  address text,
  service_or_product text,
  preferred_date text,
  source text NOT NULL DEFAULT 'facebook',
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  notes text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own leads" ON public.leads
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_leads_user_created ON public.leads(user_id, created_at DESC);
