-- Forward fix for 20260930110000_payments.sql (applied to DEV; not edited).
--
-- BUG: members were granted column-limited SELECT on payment_transactions WITHOUT user_id. The app's payment history
-- filters `.eq('user_id', <me>)`, and PostgreSQL requires SELECT privilege on every column referenced in a filter, so
-- the query fails with "permission denied for table payment_transactions" even though RLS would have limited the rows.
-- user_id is the member's own id, so exposing it in their own rows leaks nothing; provider/internal columns
-- (provider_customer_id, idempotency_key, metadata, failure_message) stay ungranted.
grant select (user_id) on table public.payment_transactions to authenticated;
