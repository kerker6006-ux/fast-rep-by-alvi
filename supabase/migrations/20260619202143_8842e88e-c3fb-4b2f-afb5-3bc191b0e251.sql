
SELECT vault.create_secret(
  $SECRET$eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVydHBhdGhxdXByYWVva2FpZ3p6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDIzMzI2NCwiZXhwIjoyMDg5ODA5MjY0fQ.PLACEHOLDER$SECRET$,
  'service_role_key',
  'Used by pg_cron to call edge functions'
);
