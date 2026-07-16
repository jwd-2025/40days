-- Schedules the send-daily-videos Edge Function to run once a day at 13:00 UTC
-- (adjust the cron expression for whatever hour you want emails to go out).
--
-- Run this AFTER you've deployed the edge function with:
--   supabase functions deploy send-daily-videos
--
-- Replace the two placeholders below before running:
--   YOUR-PROJECT-REF   -> found in Supabase dashboard > Project Settings > General
--   YOUR-SERVICE-ROLE-KEY -> Project Settings > API > service_role secret
-- (This file is only ever run inside your own Supabase SQL editor, so it's fine
-- for it to contain the service role key.)

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-daily-videos',
  '0 13 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-daily-videos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR-SERVICE-ROLE-KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To check it's registered: select * from cron.job;
-- To remove it later: select cron.unschedule('send-daily-videos');
