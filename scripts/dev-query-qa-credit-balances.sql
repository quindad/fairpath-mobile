select u.email, coalesce(b.balance, 0) as balance
from auth.users u
left join public.ai_credit_balances b on b.user_id = u.id
where lower(u.email) in ('dev-free1@fairpath.test', 'dev-plus2@fairpath.test')
order by u.email;
