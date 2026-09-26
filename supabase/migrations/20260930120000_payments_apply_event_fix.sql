-- Forward fix for 20260930110000_payments.sql (already applied to DEV; not edited).
--
-- BUG: apply_payment_event declared a PL/pgSQL variable named `outcome` and then ran
--   update public.payment_events set outcome = outcome, ...
-- where the right-hand `outcome` is ambiguous between the variable and the payment_events.outcome column
-- (SQLSTATE 42702). PL/pgSQL does not catch this at CREATE time, so every webhook event would have failed at the
-- final statement and Stripe would have retried forever. The variable is renamed; behavior is otherwise identical.

create or replace function public.apply_payment_event(
  p_event_id text,
  p_type text,
  p_intent_id text,
  p_amount_received integer,
  p_currency text,
  p_amount_refunded integer,
  p_refund_id text,
  p_failure_code text,
  p_failure_message text,
  p_payload jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
  tx public.payment_transactions%rowtype;
  v_outcome text := 'ignored';
begin
  insert into public.payment_events (provider_event_id, type, payload) values (p_event_id, p_type, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider_event_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return 'duplicate'; end if;

  select * into tx from public.payment_transactions t where t.provider_payment_intent_id = p_intent_id for update;
  if not found then
    update public.payment_events e set outcome = 'unknown_transaction', processed_at = now() where e.provider_event_id = p_event_id;
    return 'unknown_transaction';
  end if;

  if p_type = 'payment_intent.succeeded' then
    if p_amount_received is distinct from tx.amount_cents or lower(coalesce(p_currency, '')) <> tx.currency then
      -- never accept a payment whose amount/currency differs from what the server priced
      update public.payment_transactions set failure_code = 'amount_mismatch', failure_message = 'Received amount did not match the server price.', updated_at = now() where id = tx.id;
      v_outcome := 'amount_mismatch';
    elsif tx.status not in ('refunded', 'partially_refunded') then
      update public.payment_transactions set status = 'succeeded', succeeded_at = coalesce(succeeded_at, now()), failure_code = null, failure_message = null, updated_at = now() where id = tx.id;
      if tx.purpose = 'housing_fasttrack' then
        -- Payment settles the ORDER only. It never touches the application's status.
        update public.housing_fasttrack_orders set status = 'paid', provider = 'stripe', provider_payment_id = p_intent_id, updated_at = now()
         where application_id = tx.purpose_ref and status <> 'refunded';
      end if;
      perform public.create_notification(tx.user_id, 'payment', 'Payment received', 'Your payment was confirmed.', '/payments',
        'payment_succeeded:' || tx.id::text, 'payment_transaction', tx.id, jsonb_build_object('transaction_id', tx.id));
      v_outcome := 'succeeded';
    end if;
  elsif p_type = 'payment_intent.processing' then
    if tx.status in ('requires_payment_method', 'requires_action', 'failed') then
      update public.payment_transactions set status = 'processing', updated_at = now() where id = tx.id;
    end if;
    v_outcome := 'processing';
  elsif p_type = 'payment_intent.requires_action' then
    if tx.status in ('requires_payment_method', 'failed') then
      update public.payment_transactions set status = 'requires_action', updated_at = now() where id = tx.id;
    end if;
    v_outcome := 'requires_action';
  elsif p_type = 'payment_intent.payment_failed' then
    if tx.status <> 'succeeded' then
      update public.payment_transactions set status = 'failed', failure_code = p_failure_code, failure_message = left(p_failure_message, 300), updated_at = now() where id = tx.id;
    end if;
    v_outcome := 'failed';
  elsif p_type = 'payment_intent.canceled' then
    if tx.status <> 'succeeded' then
      update public.payment_transactions set status = 'canceled', updated_at = now() where id = tx.id;
    end if;
    v_outcome := 'canceled';
  elsif p_type = 'charge.refunded' then
    if p_refund_id is not null and p_amount_refunded is not null and p_amount_refunded > 0 then
      insert into public.payment_refunds (transaction_id, provider_refund_id, amount_cents, status)
      values (tx.id, p_refund_id, p_amount_refunded, 'succeeded')
      on conflict (provider_refund_id) do nothing;
    end if;
    if p_amount_refunded is not null and p_amount_refunded >= tx.amount_cents then
      update public.payment_transactions set status = 'refunded', updated_at = now() where id = tx.id;
      if tx.purpose = 'housing_fasttrack' then
        update public.housing_fasttrack_orders set status = 'refunded', updated_at = now() where application_id = tx.purpose_ref;
      end if;
    elsif p_amount_refunded is not null and p_amount_refunded > 0 then
      update public.payment_transactions set status = 'partially_refunded', updated_at = now() where id = tx.id;
    end if;
    v_outcome := 'refunded';
  end if;

  update public.payment_events e set outcome = v_outcome, processed_at = now() where e.provider_event_id = p_event_id;
  return v_outcome;
end;
$$;
revoke all on function public.apply_payment_event(text, text, text, integer, text, integer, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_payment_event(text, text, text, integer, text, integer, text, text, text, jsonb) to service_role;
