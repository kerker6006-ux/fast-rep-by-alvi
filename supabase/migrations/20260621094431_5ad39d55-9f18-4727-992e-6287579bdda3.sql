
-- Add free trial tracking to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS free_until timestamptz NOT NULL DEFAULT (now() + interval '30 days');

-- Backfill existing users: 30 days from their signup
UPDATE public.profiles SET free_until = created_at + interval '30 days' WHERE free_until IS NULL OR free_until = now() + interval '30 days';

-- Replace credits-seed trigger to grant $2 welcome bonus
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance) VALUES (NEW.id, 2.00)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (NEW.id, 2.00, 'recharge', 'Welcome bonus — $2 free credit');

  RETURN NEW;
END;
$$;

-- Grant existing users with zero balance their welcome bonus (one-time backfill, idempotent via marker txn)
INSERT INTO public.credit_transactions (user_id, amount, type, description)
SELECT p.id, 2.00, 'recharge', 'Welcome bonus — $2 free credit'
FROM public.profiles p
LEFT JOIN public.credit_transactions ct ON ct.user_id = p.id AND ct.description = 'Welcome bonus — $2 free credit'
WHERE ct.id IS NULL;

UPDATE public.user_credits uc
SET balance = uc.balance + 2.00, updated_at = now()
WHERE uc.user_id IN (
  SELECT user_id FROM public.credit_transactions
  WHERE description = 'Welcome bonus — $2 free credit'
  GROUP BY user_id HAVING COUNT(*) = 1
)
AND uc.balance < 2.00;

-- Seed credits row for any profile missing it
INSERT INTO public.user_credits (user_id, balance)
SELECT id, 2.00 FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;
