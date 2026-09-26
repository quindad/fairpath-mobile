// Payment architecture audit (Stripe): server-authoritative price/state, idempotent webhooks, no secrets in the app.
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/--.*$/gm, '');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

const appFiles = [...walk('src'), 'app.json', 'app.config.js', '.env.example', 'eas.json'].filter((f) => fs.existsSync(f)).map((f) => f.replace(/\\/g, '/'));

// ---- no secrets in the bundle ----
for (const f of appFiles) {
  const src = read(f);
  check(!/sk_(live|test)_[A-Za-z0-9]{10,}|whsec_[A-Za-z0-9]{10,}|rk_(live|test)_/.test(src), `${f} contains a Stripe secret/webhook key.`);
  check(!/EXPO_PUBLIC_[A-Z_]*(SECRET|WEBHOOK|SERVICE_ROLE)/.test(src), `${f} exposes a secret through an EXPO_PUBLIC_ variable.`);
  if (f.startsWith('src/')) check(!/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY/.test(src), `${f} references a server-only secret name.`);
}
check(/EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY/.test(read('.env.example')), 'Publishable key variable must be documented.');
check(!fs.existsSync('.env.local') || !/sk_(live|test)_/.test(read('.env.local')), '.env.local must not hold a Stripe secret key.');

// ---- client cannot choose price / declare success ----
const svc = read('src/core/payments/payments-service.ts');
check(/invoke\('create-fasttrack-payment', \{ body: \{ application_id: applicationId \} \}\)/.test(svc), 'The client may send only the application id to the payment function.');
check(!/amount(_cents)?\s*:\s*[a-zA-Z]/.test(svc.split('prepareFastTrackPayment')[1]?.split('export type SettlementResult')[0] ?? ''), 'The client must not send an amount.');
check(/waitForPaymentSettlement/.test(svc) && /from\('payment_transactions'\)\.select\('status'\)/.test(svc), 'Settlement must be read from the server-recorded transaction.');
const checkout = read('src/app/fasttrack-checkout/[id].tsx');
check(/waitForPaymentSettlement/.test(checkout) && /Payment confirmed\./.test(checkout), 'Checkout must wait for server confirmation.');
check(!/setQuote\(\s*\{[^}]*status:\s*'paid'/.test(checkout) && !/\.status\s*=\s*'paid'/.test(checkout), 'The app must never mark an order paid because the sheet closed.');
check(/does not approve your application/.test(checkout), 'Checkout must state that payment is not approval.');
check(/quote\.amount_due_cents/.test(checkout) && /loadFastTrackQuote/.test(checkout), 'Displayed price must come from the server quote.');
const sheet = read('src/core/payments/payment-sheet.native.ts');
check(/NOT proof of payment|not proof of payment/i.test(sheet), 'The native sheet wrapper must document that completion is not proof of payment.');
check(/applePay:\s*Platform\.OS === 'ios' && merchantId/.test(sheet) && /googlePay:\s*googlePay/.test(sheet), 'Apple Pay / Google Pay must be configured only when their merchant setup exists.');
check(/merchantIdentifier:\s*process\.env\.APPLE_MERCHANT_ID \|\| undefined/.test(read('app.config.js')), 'The Apple Pay entitlement must be env-gated so an unconfigured merchant id cannot break builds.');
check(!/card_?number|\bcvc\b|\bcvv\b|pan\b/i.test(strip(svc + checkout + sheet)), 'Raw card fields must never appear in app code.');

// ---- Edge Functions ----
const create = strip(read('supabase/functions/create-fasttrack-payment/index.ts'));
check(/userClient\.auth\.getUser\(\)/.test(create) && /Authorization/.test(create), 'create-fasttrack-payment must authenticate the member.');
check(/quote_housing_fasttrack/.test(create) && /quote\.amount_due_cents/.test(create), 'The amount must come from the server quote.');
check(!/body\.(amount|price|currency|total)/.test(create), 'The payment function must not read an amount/price from the request.');
check(/app\.application_type !== 'fasttrack'/.test(create) && /app\.status !== 'started'/.test(create) && /app\.user_id !== user\.id/.test(create), 'Payment purpose must be validated server-side.');
check(/idempotencyKey/.test(create) && /create_payment_transaction/.test(create), 'Payment creation must be idempotent and recorded.');
check(/requireEnv\('STRIPE_SECRET_KEY'\)/.test(create) && /501/.test(create), 'The secret key must come from function env and the function must refuse when unset.');
const hook = strip(read('supabase/functions/stripe-webhook/index.ts'));
check(/constructEventAsync/.test(hook) && /STRIPE_WEBHOOK_SECRET/.test(hook) && /invalid_signature/.test(hook), 'The webhook must verify Stripe signatures.');
check(/apply_payment_event/.test(hook) && /status\(500|json\(500/.test(hook.replace(/\s+/g, ' ')), 'The webhook must use apply_payment_event and fail (retryable) on processing errors.');
check(!/housing_applications/.test(hook), 'The webhook must never touch housing applications: payment is not approval.');
check(/verify_jwt = false/.test(read('supabase/config.toml')) && /\[functions\.stripe-webhook\]/.test(read('supabase/config.toml')), 'The webhook must be deployed without JWT verification (Stripe signs it instead).');

// ---- database ----
const mig = strip(read('supabase/migrations/20260930110000_payments.sql'));
check(/provider_event_id text primary key/.test(mig) && /return 'duplicate'/.test(mig), 'Webhook events must be idempotent by Stripe event id.');
check(/amount_mismatch/.test(mig) && /p_amount_received is distinct from tx\.amount_cents/.test(mig), 'A payment whose amount differs from the server price must be rejected.');
check(!/update public\.housing_applications|insert into public\.housing_applications/i.test(mig), 'Payments must never write housing application status.');
check(!/status = 'approved'/.test(mig), 'A payment must not set an approved state.');
check(/create table if not exists public\.payment_refunds/.test(mig) && /charge\.refunded/.test(mig) && /'refunded'/.test(mig), 'Refund-ready architecture is required.');
check(/create table if not exists public\.payment_products/.test(mig) && /payment_products p where p\.code = 'fasttrack_application'/.test(mig), 'Pricing must live server-side in payment_products.');
check(/has_fairpath_plus\(v_user\)/.test(mig), 'The FairPath+ discount must come from the server entitlement check.');
check(/payment_transactions_one_open_per_ref/.test(mig), 'Only one live payment attempt per application.');
check(/revoke insert, update, delete on table public\.housing_fasttrack_orders from authenticated/.test(mig), 'Members must not edit orders.');
check(!/grant\s+(insert|update|delete)[^;]*on table public\.payment_(transactions|refunds|events|products)[^;]*to authenticated/i.test(mig), 'Clients must not write payment tables.');
check(/grant select \([^)]*\)\s+on table public\.payment_transactions to authenticated/.test(mig) && !/metadata[^;]*to authenticated/.test(mig.split('grant select (id, purpose')[1]?.split(';')[0] ?? ''), 'Members see receipts through column-limited grants (no metadata).');
check(/revoke all on function public\.apply_payment_event[\s\S]*?from public, anon, authenticated/.test(mig), 'apply_payment_event must be service-only.');
check(!/card|pan\b|cvc/i.test(mig.replace(/'requires_payment_method'|payment_method/g, '')), 'No card data may be stored.');

// ---- column grants must cover every column the app filters on (PostgreSQL requires SELECT on filter columns) ----
{
  const allMig = fs.readdirSync('supabase/migrations').filter((x) => x.endsWith('.sql')).map((x) => strip(read('supabase/migrations/' + x))).join('\n');
  const granted = new Set();
  for (const m of allMig.matchAll(/grant select \(([^)]*)\)\s+on table public\.payment_transactions to authenticated/g)) m[1].split(',').forEach((c) => granted.add(c.trim()));
  const q = svc.match(/from\('payment_transactions'\)[\s\S]*?;/g) ?? [];
  for (const stmt of q) {
    for (const c of [...stmt.matchAll(/\.(?:eq|in|neq|gt|lt|order)\('([a-z_]+)'/g)].map((x) => x[1])) check(granted.has(c), 'payments-service filters/orders payment_transactions by "' + c + '" but members have no column grant on it (permission denied at runtime).');
    const sel = stmt.match(/\.select\('([^']*)'\)/);
    if (sel) for (const c of sel[1].split(',').map((x) => x.trim())) check(granted.has(c), 'payments-service selects payment_transactions."' + c + '" without a column grant.');
  }
}

// ---- FairPath+ is not sold through Stripe ----
check(!/subscriptions\.create|mode:\s*'subscription'|fairpath_plus/i.test(create + hook), 'FairPath+ subscriptions must not be processed through Stripe checkout.');

// ---- history is separate from application status ----
const history = read('src/app/payments.tsx');
check(!/housing_application_events|loadHousingApplicationEvents/.test(history) && /separate from your application status/.test(history), 'Payment history must be separate from application history.');

// ---- executable formatting rules ----
const f = await import('../src/core/payments/payment-format.ts');
check(f.formatCents(6500) === '$65.00' && f.formatCents(7500) === '$75.00' && f.formatCents(0) === '$0.00', 'formatCents is wrong.');
check(f.paymentStatusLabel('succeeded') === 'PAID' && f.paymentStatusLabel('requires_payment_method') === 'NOT COMPLETED' && f.paymentStatusLabel('refunded') === 'REFUNDED', 'Status labels must not call unsettled payments PAID.');
check(f.isSettled('succeeded') && f.isSettled('failed') && !f.isSettled('processing') && !f.isSettled('requires_payment_method'), 'isSettled is wrong.');
check(/^FP-[0-9A-F]{8}$/.test(f.receiptRef('123e4567-e89b-12d3-a456-426614174000')), 'Receipt reference format is wrong.');

if (failures.length) { console.error('Payments audit failed:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('Payments audit passed: server-priced, webhook-settled, idempotent, refund-ready, no secrets or card data in the app, payment never approves an application.');
