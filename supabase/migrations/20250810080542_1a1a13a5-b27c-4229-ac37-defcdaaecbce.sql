-- Schedule daily reminders (09:00 UTC) to call edge function 'send-renewal-reminders'
DO $$
BEGIN
  -- First try to unschedule if it exists
  BEGIN
    PERFORM cron.unschedule('send-renewal-reminders-daily');
  EXCEPTION WHEN OTHERS THEN
    -- Ignore if job doesn't exist
    NULL;
  END;
  
  -- Now schedule the job
  PERFORM cron.schedule(
    'send-renewal-reminders-daily',
    '0 9 * * *',
    $$select net.http_post(
        url:='https://efeommwlobsenrvqedcj.supabase.co/functions/v1/send-renewal-reminders',
        headers:='{"Content-Type":"application/json"}'::jsonb,
        body:='{}'::jsonb
    )$$
  );
END$$;