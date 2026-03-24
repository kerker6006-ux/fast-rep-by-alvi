-- Fix existing conversations and messages with null user_id
UPDATE public.conversations SET user_id = 'c7285f52-c79f-4ea4-b443-19e082a9d137' WHERE user_id IS NULL;
UPDATE public.messages SET user_id = 'c7285f52-c79f-4ea4-b443-19e082a9d137' WHERE user_id IS NULL;