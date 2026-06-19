
SELECT cron.unschedule('send-scheduled-messages');
SELECT cron.schedule(
  'send-scheduled-messages',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://urtpathqupraeokaigzz.supabase.co/functions/v1/send-scheduled',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
