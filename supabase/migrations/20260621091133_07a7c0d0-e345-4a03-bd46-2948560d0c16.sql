
-- ============================================================
-- FastRep Big Update — Foundation Migration (all phases)
-- ============================================================

-- ---------- Phase 1.1: Comment Triggers ----------
CREATE TABLE IF NOT EXISTS public.comment_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fb_page_id TEXT,
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  match_type TEXT NOT NULL DEFAULT 'contains',
  dm_message TEXT NOT NULL,
  dm_image_url TEXT,
  public_reply TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER NOT NULL DEFAULT 1000,
  sent_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_triggers TO authenticated;
GRANT ALL ON public.comment_triggers TO service_role;
ALTER TABLE public.comment_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own comment_triggers" ON public.comment_triggers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all comment_triggers" ON public.comment_triggers
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_comment_triggers_user ON public.comment_triggers(user_id, is_enabled);

CREATE TABLE IF NOT EXISTS public.comment_trigger_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_id UUID REFERENCES public.comment_triggers(id) ON DELETE SET NULL,
  fb_comment_id TEXT NOT NULL UNIQUE,
  fb_post_id TEXT,
  commenter_id TEXT,
  commenter_name TEXT,
  comment_text TEXT,
  matched_keyword TEXT,
  dm_status TEXT NOT NULL DEFAULT 'pending',
  dm_sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_trigger_logs TO authenticated;
GRANT ALL ON public.comment_trigger_logs TO service_role;
ALTER TABLE public.comment_trigger_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own trigger logs" ON public.comment_trigger_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read all trigger logs" ON public.comment_trigger_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_ctl_user_created ON public.comment_trigger_logs(user_id, created_at DESC);

-- ---------- Phase 1.3: Image analysis toggle (no schema, bot_settings is KV) ----------

-- ---------- Phase 1.5: FB read/delivery tracking ----------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fb_message_id TEXT;

-- ---------- Phase 2: tokens_used on ai_usage ----------
ALTER TABLE public.ai_usage
  ADD COLUMN IF NOT EXISTS tokens_used INTEGER DEFAULT 0;

-- ---------- Phase 2/10: Webhook failures log ----------
CREATE TABLE IF NOT EXISTS public.webhook_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  user_id UUID,
  payload JSONB,
  error TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.webhook_failures TO authenticated;
GRANT ALL ON public.webhook_failures TO service_role;
ALTER TABLE public.webhook_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read webhook_failures" ON public.webhook_failures
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_webhook_failures_created ON public.webhook_failures(created_at DESC);

-- ---------- Phase 3: Notifications ----------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at, created_at DESC);

-- Enable realtime for notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Triggers to auto-create notifications
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.user_id,
    'order',
    'New order received',
    COALESCE(NEW.customer_name, 'Customer') || ' placed an order',
    '#orders',
    jsonb_build_object('order_id', NEW.id)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_order ON public.orders;
CREATE TRIGGER trg_notify_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();

CREATE OR REPLACE FUNCTION public.notify_new_complaint()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.user_id,
    'appointment',
    'New callback request',
    COALESCE(NEW.customer_name, 'Customer') || ' needs a callback',
    '#complaints',
    jsonb_build_object('complaint_id', NEW.id)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_new_complaint ON public.complaints;
CREATE TRIGGER trg_notify_new_complaint
  AFTER INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_complaint();

-- ---------- Phase 4.9: Job queue ----------
CREATE TABLE IF NOT EXISTS public.job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.job_queue TO authenticated;
GRANT ALL ON public.job_queue TO service_role;
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own jobs" ON public.job_queue
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins read all jobs" ON public.job_queue
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_job_queue_pending ON public.job_queue(status, run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_job_queue_user ON public.job_queue(user_id, created_at DESC);

-- ---------- Phase 4.9: Performance indexes ----------
CREATE INDEX IF NOT EXISTS idx_messages_convo_created ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_image ON public.messages(user_id, created_at DESC) WHERE image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON public.ai_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_last ON public.conversations(user_id, last_message_at DESC);

-- ---------- updated_at trigger for comment_triggers ----------
DROP TRIGGER IF EXISTS trg_comment_triggers_updated ON public.comment_triggers;
CREATE TRIGGER trg_comment_triggers_updated
  BEFORE UPDATE ON public.comment_triggers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Phase 4.8: schema_version marker ----------
INSERT INTO public.app_settings (key, value)
VALUES ('schema_version', '2'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
