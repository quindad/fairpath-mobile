select u.email, l.delta, l.reason, l.workflow, l.balance_after, l.created_at
from public.ai_credit_ledger l
join auth.users u on u.id = l.user_id
where lower(u.email) = 'dev-free1@fairpath.test'
order by l.created_at desc
limit 5;
