
-- Create order status enum
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'processing', 'delivered', 'cancelled');

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC NOT NULL DEFAULT 0,
  status order_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Service can insert orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update orders" ON public.orders FOR UPDATE USING (true);

-- Auto reply rules table
CREATE TABLE public.auto_reply_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_keywords TEXT[] NOT NULL DEFAULT '{}',
  response_text TEXT NOT NULL,
  response_text_bn TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_reply_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rules" ON public.auto_reply_rules FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage rules" ON public.auto_reply_rules FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Scheduled messages table
CREATE TYPE public.scheduled_message_status AS ENUM ('pending', 'sent', 'failed', 'cancelled');

CREATE TABLE public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status scheduled_message_status NOT NULL DEFAULT 'pending',
  message_type TEXT NOT NULL DEFAULT 'follow_up',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read scheduled messages" ON public.scheduled_messages FOR SELECT USING (true);
CREATE POLICY "Service can insert scheduled messages" ON public.scheduled_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update scheduled messages" ON public.scheduled_messages FOR UPDATE USING (true);

-- Add triggers for updated_at
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_auto_reply_rules_updated_at BEFORE UPDATE ON public.auto_reply_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_messages;
