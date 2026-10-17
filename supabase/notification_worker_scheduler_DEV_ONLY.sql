-- DEV-ONLY OPERATOR TEMPLATE. DO NOT APPLY AS A MIGRATION OR RUN AGAINST PROD.
-- Prerequisites: pg_cron, pg_net, Vault enabled; DEV worker functions deployed.
-- Store NOTIFICATION_WORKER_SECRET in Supabase Vault first, with name
-- fairpath_notification_worker_secret_dev. Never paste the secret in SQL.
-- Review linked project ref before running this template manually in DEV SQL editor.
DO $$ BEGIN
 IF current_setting('app.settings.project_ref', true) IS DISTINCT FROM 'znvhmuhojvwvjzmaqwff' THEN
  RAISE EXCEPTION 'Project identity not confirmed. Configure DEV project ref before scheduling.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='fairpath_notification_worker_secret_dev') THEN
  RAISE EXCEPTION 'Missing DEV worker secret in Vault';
 END IF;
END $$;

SELECT cron.schedule('fairpath-notification-delivery-dev','* * * * *', $$
 SELECT net.http_post(
  url := 'https://znvhmuhojvwvjzmaqwff.supabase.co/functions/v1/notification-delivery-worker',
  headers := jsonb_build_object('Content-Type','application/json','Authorization',
   'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='fairpath_notification_worker_secret_dev' LIMIT 1)),
  body := '{}'::jsonb, timeout_milliseconds := 25000
 );
$$);
SELECT cron.schedule('fairpath-notification-receipts-dev','*/5 * * * *', $$
 SELECT net.http_post(
  url := 'https://znvhmuhojvwvjzmaqwff.supabase.co/functions/v1/notification-receipt-worker',
  headers := jsonb_build_object('Content-Type','application/json','Authorization',
   'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='fairpath_notification_worker_secret_dev' LIMIT 1)),
  body := '{}'::jsonb, timeout_milliseconds := 25000
 );
$$);
-- ROLLBACK: SELECT cron.unschedule('fairpath-notification-delivery-dev');
-- ROLLBACK: SELECT cron.unschedule('fairpath-notification-receipts-dev');
