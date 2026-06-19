
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'facebook';
CREATE INDEX IF NOT EXISTS conversations_channel_idx ON public.conversations(channel);
