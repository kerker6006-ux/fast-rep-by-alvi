
CREATE TABLE public.data_deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  confirmation_code TEXT NOT NULL UNIQUE,
  user_facebook_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_request TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ddr_confirmation_code ON public.data_deletion_requests(confirmation_code);
CREATE INDEX idx_ddr_fb_id ON public.data_deletion_requests(user_facebook_id);

GRANT SELECT ON public.data_deletion_requests TO anon;
GRANT SELECT ON public.data_deletion_requests TO authenticated;
GRANT ALL ON public.data_deletion_requests TO service_role;

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can look up status by confirmation code"
  ON public.data_deletion_requests FOR SELECT
  USING (true);

CREATE TRIGGER ddr_set_updated_at
  BEFORE UPDATE ON public.data_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
