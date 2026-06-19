
SELECT cron.unschedule('send-scheduled-messages');
SELECT cron.schedule(
  'send-scheduled-messages',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://urtpathqupraeokaigzz.supabase.co/functions/v1/send-scheduled',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVydHBhdGhxdXByYWVva2FpZ3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDIzMzI2NCwiZXhwIjoyMDg5ODA5MjY0fQ.OA22bHUT0Mdj8IkdLH_QLD4PPL4SjQHqtRWpjNIDHLM'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
