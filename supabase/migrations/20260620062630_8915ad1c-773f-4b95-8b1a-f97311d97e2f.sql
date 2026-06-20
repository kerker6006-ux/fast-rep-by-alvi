
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_plan text,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_stripe_session_id_key
  ON public.credit_transactions(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
