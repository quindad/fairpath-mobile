// FairPath+ entitlement audit: server-evaluated, source-tracked, no client self-grants, no auto-charge.
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/--.*$/gm, '');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

const mig = strip(read('supabase/migrations/20260930100000_entitlements.sql'));
const fn = (name) => (mig.match(new RegExp('create or replace function public\\.' + name + '\\([\\s\\S]*?\\n\\$\\$;')) || [''])[0];

// ---- model ----
for (const t of ['correctional_transition', 'institution_sponsor', 'nonprofit_sponsor', 'promo', 'partner', 'admin_grant', 'support_exception']) {
  check(mig.includes("'" + t + "'"), `entitlement source '${t}' must be representable.`);
}
for (const col of ['source_type', 'source_ref', 'starts_at', 'expires_at', 'status', 'granted_by']) check(new RegExp('\\b' + col + '\\b').test(mig.split('create table if not exists public.billing_subscriptions')[0]), `entitlement_grants needs ${col}.`);
for (const col of ['provider', 'external_subscription_id', 'auto_renew', 'current_period_end']) check(new RegExp('\\b' + col + '\\b').test(mig), `billing_subscriptions needs ${col}.`);
check(/provider text not null check \(provider in \('apple', 'google', 'stripe', 'manual'\)\)/.test(mig), 'Subscriptions must be provider-neutral.');
check(!/is_plus|plus_enabled|has_plus\s+boolean/i.test(mig), 'FairPath+ must not be a boolean column.');

// ---- server-evaluated expiry ----
const status = fn('fairpath_plus_status');
check(/e\.expires_at > now\(\)/.test(status) && /e\.starts_at <= now\(\)/.test(status) && /e\.status = 'active'/.test(status), 'Grant validity must be evaluated on the server at read time.');
check(/expired_source/.test(status), 'The server must report an ended grant so the client can show renewal.');
check(/security definer/.test(fn('my_fairpath_plus_status')) && /auth\.uid\(\)/.test(fn('my_fairpath_plus_status')), 'The only client entry point must be about the caller.');
check(/grant execute on function public\.my_fairpath_plus_status\(\) to authenticated/.test(mig), 'my_fairpath_plus_status must be callable by members.');
check(/revoke all on function public\.fairpath_plus_status\(uuid\) from public, anon, authenticated/.test(mig) && /revoke all on function public\.has_fairpath_plus\(uuid\) from public, anon, authenticated/.test(mig), 'Evaluating another user must be server-only.');

// ---- clients cannot grant ----
check(/grant select on table public\.entitlement_grants to authenticated/.test(mig) && !/grant\s+(insert|update|delete)[^;]*on table public\.(entitlement_grants|billing_subscriptions|corrections_migration_events|entitlement_audit_log)[^;]*to authenticated/i.test(mig), 'Members may only read their grants.');
check(/revoke insert, update, delete on table public\.fairpath_subscriptions from authenticated/.test(mig) && /revoke all on table public\.fairpath_subscriptions from anon/.test(mig), 'The legacy subscription table must not be client-writable.');
for (const name of ['issue_entitlement_grant', 'claim_correctional_transition', 'revoke_entitlement_grant', 'extend_entitlement_grant', 'apply_subscription_event', 'send_entitlement_reminders', 'sync_legacy_fairpath_plus']) {
  check(new RegExp('revoke all on function public\\.' + name + '[\\s\\S]*?from public, anon, authenticated').test(mig) && new RegExp('grant execute on function public\\.' + name + '[\\s\\S]*?to service_role').test(mig), `${name} must be service_role only.`);
}
check(/reason/.test(fn('revoke_entitlement_grant')) && /REASON_REQUIRED/.test(fn('revoke_entitlement_grant')) && /REASON_REQUIRED/.test(fn('extend_entitlement_grant')), 'Support exceptions must require an audited reason.');
check(/entitlement_audit_log_immutable/.test(mig) && /before update or delete/.test(mig), 'The audit log must be append-only.');

// ---- correctional transition rules ----
// The LATEST definition wins (a forward migration superseded the original ordering).
const fixMig = strip(read('supabase/migrations/20260930140000_claim_and_apply_ordering_fixes.sql'));
const claim = (fixMig.match(/create or replace function public\.claim_correctional_transition\([\s\S]*?\n\$\$;/) || [''])[0];
check(claim.length > 0, 'The claim function must be defined by the ordering fix migration.');
{
  const identityCheck = claim.indexOf('where c.identity_key = p_identity_key');
  const accountCheck = claim.indexOf("g.source_type = 'correctional_transition'");
  const insertEvent = claim.indexOf('insert into public.corrections_migration_events');
  check(identityCheck > -1 && identityCheck < accountCheck && accountCheck < insertEvent, 'Claim order must be: identity already processed -> account already has a grant -> consume the identity and issue.');
  check(/'already_claimed'/.test(claim.slice(identityCheck, accountCheck)), 'A repeat claim of a processed identity must report already_claimed.');
}
check(/, 90,/.test(claim), 'The correctional benefit must be 90 days.');
check(/identity_key text not null unique/.test(mig) && /on conflict \(identity_key\) do nothing/.test(claim), 'One verified Corrections identity can be claimed once.');
check(/account_already_has_benefit/.test(claim) && /entitlement_grants_one_correctional_per_user/.test(mig), 'One account can hold only one correctional grant.');
check(/verified_by/.test(claim) && /verified_at/.test(claim), 'Eligibility must come from a verified migration event.');
check(!/payment|stripe|card|checkout|charge|subscription|billing/i.test(claim), 'The correctional claim must involve no payment of any kind.');
check(!/conviction|offense|supervision|registration|justice|profile_answers/i.test(mig), 'Eligibility must never be inferred from conviction/profile data.');
check(!/delete from|drop table|truncate/i.test(mig), 'Expiry/support tools must never delete data.');
check(!/update public\.(profiles|housing_applications|job_applications|saved_)/i.test(mig), 'Entitlement code must not touch the account, applications or saved items.');
check(!/payment_transactions|stripe_customers|payment_products/.test(mig), 'Entitlements must not create charges or payment records.');
check(/'Nothing will be charged/.test(mig) || /Nothing will be charged/.test(mig), 'Reminders must state that nothing will be charged.');
check(/entitlement_expiring:/.test(mig) && /array\[14, 7, 1\]/.test(mig) && /entitlement_expired:/.test(mig), 'Advance reminders (14/7/1 days) and an expiry notice are required, idempotently.');
check(/cron\.schedule\('fairpath-entitlement-reminders'/.test(mig), 'Reminders must be scheduled.');
check(/sync_legacy_fairpath_plus/.test(fn('issue_entitlement_grant')) && /current_period_end/.test(fn('sync_legacy_fairpath_plus')), 'Existing server checks (Marketplace/FastTrack) must follow the entitlement system.');

// ---- trusted issuance path ----
const edge = strip(read('supabase/functions/claim-correctional-transition/index.ts'));
check(/CORRECTIONS_INTEGRATION_SECRET/.test(edge) && /timingSafeEqual/.test(edge) && /501/.test(edge), 'The claim endpoint must authenticate the Corrections integration and refuse when unconfigured.');
check(!/body\.(days|expires|source|amount)|days:|expires_at:\s*body/.test(edge), 'The caller must not choose the duration.');
check(/claim_correctional_transition/.test(edge) && /p_verified_by: 'corrections-integration'/.test(edge), 'The edge function must call the audited claim function.');
check(/\[functions\.claim-correctional-transition\][\s\S]*?verify_jwt = false/.test(read('supabase/config.toml')), 'Server-to-server function deployment config is missing.');

// ---- client never trusts flags ----
const src = walk('src').filter((f) => /\.(tsx?|mjs)$/.test(f)).map((f) => f.replace(/\\/g, '/'));
for (const f of src) {
  const code = strip(read(f));
  check(!/\b(is_plus|isPlus|tablet_user|is_incarcerated|plus_active)\b\s*[:=]\s*(true|['"]true['"])/.test(code), `${f} sets a client-controlled entitlement flag.`);
  check(!/from\('(entitlement_grants|billing_subscriptions|fairpath_subscriptions)'\)\s*\.(insert|update|upsert|delete)/.test(code), `${f} writes entitlement tables from the client.`);
}
const access = read('src/core/membership/plus-access.ts');
check(/rpc\('my_fairpath_plus_status'\)/.test(access) && /return NO_PLUS/.test(access), 'The client must read status from the server and fail closed.');

// ---- one product configuration ----
for (const f of src.filter((x) => x.startsWith('src/app/'))) {
  const code = strip(read(f));
  check(!/\$65|\$75|\$2\b|\$2\/|'\$2'/.test(code.replace(/\$\{/g, '')), `${f} hard-codes a price; use plus-config / server pricing.`);
}
check(/FAIRPATH_PLUS_PRODUCT/.test(read('src/core/membership/plus-config.ts')) && /export \{ FAIRPATH_PLUS_MONTHLY_PRICE_USD \}/.test(read('src/core/membership/fairpath-plus.ts')), 'FairPath+ pricing must come from the single config.');
const billing = read('src/core/billing/billing-provider.ts');
check(/not_configured/.test(billing) && !/purchased_pending_verification'\s*\}\s*;?\s*$/m.test(billing.split('class NotConfiguredProvider')[1]?.split('export function getBillingProvider')[0] ?? ''), 'The unconfigured billing provider must never report a purchase.');
check(/501/.test(read('supabase/functions/store-subscription-webhook/index.ts')), 'The store webhook must refuse until store verification exists.');

// ---- executable UI rules ----
const p = await import('../src/core/membership/plus-status.ts');
const comp = { active: true, source: 'correctional_transition', complimentary: true, expires_at: '2026-12-27T00:00:00Z', days_remaining: 90, will_renew: false };
const v1 = p.describePlus(comp);
check(v1.tone === 'complimentary' && !v1.showSubscribe && /No payment is needed/.test(v1.detail) && /nothing will be charged/i.test(v1.detail) && /90 days left/.test(v1.detail), 'Complimentary access must show its end and promise no charge.');
check(p.hasFeature(comp, 'ai_resume') === true && p.hasFeature(p.NO_PLUS, 'ai_resume') === false, 'Feature gating must follow server status.');
const expired = { active: false, source: null, expired_source: 'correctional_transition', expired_at: '2026-12-27T00:00:00Z' };
const v2 = p.describePlus(expired);
check(v2.tone === 'expired' && v2.showSubscribe && /account, profile, applications and saved items are unchanged/.test(v2.detail), 'Expired access must keep the account intact and offer renewal.');
check(p.describePlus(p.NO_PLUS).tone === 'none' && p.describePlus(p.NO_PLUS).showSubscribe, 'Free members see the normal offer.');
check(p.isExpiringSoon({ ...comp, days_remaining: 7 }) && !p.isExpiringSoon({ ...comp, days_remaining: 60 }) && !p.isExpiringSoon({ active: true, source: 'paid_subscription', complimentary: false, days_remaining: 3 }), 'Expiring-soon logic is wrong.');
check(p.daysLeft(p.NO_PLUS) === null && p.daysLeft(comp) === 90, 'daysLeft is wrong.');

if (failures.length) { console.error('Entitlements audit failed:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('Entitlements audit passed: server-evaluated multi-source FairPath+, 90-day correctional grant with no payment path, audited service-only issuance, no client self-grants, expiry never touches account data.');
