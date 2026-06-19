-- Update trigger to recognize new admin email and grant admin role to new account; revoke from old.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'fastrepbyalvi@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Grant admin role to the new admin user, remove from old one
INSERT INTO public.user_roles (user_id, role)
VALUES ('60b2383f-bc44-41b6-bf75-b539ab94ddaf', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE user_id = 'd9c6221f-45ec-4fc6-9c56-b775a4b5671e' AND role = 'admin';

-- Ensure profile + credits exist for new admin
INSERT INTO public.profiles (id, display_name)
VALUES ('60b2383f-bc44-41b6-bf75-b539ab94ddaf', 'Admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_credits (user_id, balance)
VALUES ('60b2383f-bc44-41b6-bf75-b539ab94ddaf', 0)
ON CONFLICT (user_id) DO NOTHING;
