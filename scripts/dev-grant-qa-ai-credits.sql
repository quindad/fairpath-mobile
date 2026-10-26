-- DEV QA starter credits (idempotent top-up). Safe to re-run: only grants when balance is below floor.
do $$
declare
  r record;
  v_balance integer;
  v_delta integer;
begin
  for r in
    select * from (values
      ('dev-free1@fairpath.test', 3, 10),
      ('dev-plus2@fairpath.test', 15, 50)
    ) as t(email, floor_balance, target_balance)
  loop
    select coalesce(b.balance, 0) into v_balance
    from auth.users u
    left join public.ai_credit_balances b on b.user_id = u.id
    where lower(u.email) = lower(r.email);

    if v_balance is null then
      raise notice 'skip missing user %', r.email;
      continue;
    end if;

    if v_balance >= r.floor_balance then
      raise notice 'skip % balance=%', r.email, v_balance;
      continue;
    end if;

    v_delta := r.target_balance - v_balance;
    perform public.grant_ai_credits(u.id, v_delta, 'admin_adjustment')
    from auth.users u
    where lower(u.email) = lower(r.email);

    raise notice 'granted % +% credits', r.email, v_delta;
  end loop;
end $$;

select u.email, coalesce(b.balance, 0) as balance
from auth.users u
left join public.ai_credit_balances b on b.user_id = u.id
where lower(u.email) in ('dev-free1@fairpath.test', 'dev-plus2@fairpath.test')
order by u.email;
