// Notification foundation + inquiry status audit.
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

const mig = read('supabase/migrations/20260929100000_inquiry_status_and_notifications.sql').replace(/--.*$/gm, '');
const fn = (name) => (mig.match(new RegExp('create or replace function public\\.' + name + '\\([\\s\\S]*?\\n\\$\\$;')) || [''])[0];

// ---- notifications: idempotent, server-created, client can only mark read ----
const create = fn('create_notification');
check(create && /security definer/.test(create), 'create_notification must be SECURITY DEFINER.');
check(/on conflict \(user_id, dedupe_key\)/.test(create), 'create_notification must be idempotent per (user, dedupe_key).');
check(/create unique index if not exists user_notifications_dedupe_idx/.test(mig), 'A unique dedupe index is required.');
check(/revoke all on function public\.create_notification[\s\S]*?from public, anon, authenticated/.test(mig), 'Clients must not be able to call create_notification.');
check(/revoke insert, update, delete on table public\.user_notifications from authenticated/.test(mig) && /grant update \(read_at\) on table public\.user_notifications to authenticated/.test(mig), 'Clients may only update read_at on notifications.');
check(/revoke all on table public\.user_notifications from anon/.test(mig), 'Anonymous users must have no access to notifications.');
check(/unread_notification_count/.test(mig) && /auth\.uid\(\)/.test(fn('unread_notification_count')), 'Unread count must be owner-scoped.');
check(/alter table public\.notification_deliveries enable row level security/.test(mig) && !/create policy[^;]*notification_deliveries/.test(mig), 'notification_deliveries must be server-only (RLS, no client policy).');
check(/queue_notification_delivery/.test(mig), 'Notifications must queue a delivery row for a future push worker.');
// honest push boundary: no sender in the app or migrations
const src = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(tsx?|mjs)$/.test(e.name)) src.push(p.replace(/\\/g, '/')); });
walk('src');
check(!src.some((f) => /exp\.host\/--\/api\/v2\/push|fcm\.googleapis|api\.push\.apple/.test(read(f))), 'The app must not pretend to send push notifications.');

// ---- inquiry status ----
for (const name of ['partner_acknowledge_housing_inquiry', 'partner_reply_housing_inquiry']) {
  const body = fn(name);
  check(body && /security definer/.test(body) && /h\.owner_id = uid/.test(body), `${name} must only work for the listing's owner.`);
  check(new RegExp('revoke all on function public\\.' + name + '[\\s\\S]*?from public, anon').test(mig), `${name} must not be callable by anon.`);
}
const reply = fn('partner_reply_housing_inquiry');
check(/i\.response_message is null/.test(reply), 'A reply may only be written once.');
const read_ = fn('mark_housing_inquiry_reply_read');
check(/i\.user_id = uid/.test(read_) && /responded_at is not null/.test(read_), 'Only the applicant can mark their reply read, and only if a reply exists.');
check(/housing_inquiry_reply:/.test(fn('on_housing_inquiry_response')), 'Reply notifications must be idempotent.');
check(/add column if not exists received_at/.test(mig) && /add column if not exists seen_at/.test(mig) && /add column if not exists reply_read_at/.test(mig), 'Inquiry state columns are missing.');
const sendFn = read('supabase/migrations/20260928120000_housing_applications_secure.sql');
check(/revoke insert, update, delete on table public\.housing_inquiries from authenticated/.test(sendFn), 'Clients must not write inquiries directly (cannot forge state).');
check(/interval '10 minutes'/.test(sendFn) && /RATE_LIMITED/.test(sendFn), 'Duplicate/rate protection must remain.');

const svc = read('src/core/housing/housing-service.ts');
check(!/from\('housing_inquiries'\)\s*\.(update|insert|upsert)/.test(svc), 'The client must not write inquiry rows.');
check(/rpc\('mark_housing_inquiry_reply_read'/.test(svc), 'Marking a reply read must go through the server function.');
check(!/received_at\s*:|seen_at\s*:/.test(svc.replace(/received_at:string\|null;seen_at:string\|null;/, '')), 'The client must never set received/seen.');

// ---- executable state model ----
const st = await import('../src/core/housing/inquiry-state.ts');
const base = { created_at: '2026-09-28T10:00:00Z' };
check(st.currentInquiryStage(base) === 'sent', 'An unanswered inquiry must read SENT (never fake delivered/seen).');
check(st.inquiryStages(base).filter((s) => s.reached).length === 1, 'Only SENT is reached without server events.');
check(st.currentInquiryStage({ ...base, received_at: '2026-09-28T11:00:00Z' }) === 'received', 'received_at drives RECEIVED.');
check(st.currentInquiryStage({ ...base, received_at: 'x', seen_at: 'y' }) === 'seen', 'seen_at drives SEEN.');
check(st.currentInquiryStage({ ...base, responded_at: 'z' }) === 'replied', 'responded_at drives REPLIED.');
check(st.hasUnreadReply({ ...base, responded_at: 'z' }) === true && st.hasUnreadReply({ ...base, responded_at: 'z', reply_read_at: 'r' }) === false && st.hasUnreadReply(base) === false, 'Unread reply indicator logic is wrong.');

// ---- UI ----
const act = read('src/app/housing-activity.tsx');
check(/NEW REPLY/.test(act) && /markHousingInquiryReplyRead/.test(act) && /inquiryStages/.test(act), 'Housing Activity must show stages, an unread-reply indicator and mark replies read via the server.');
check(/loadUnreadNotificationCount/.test(read('src/app/home.tsx')), 'Home must show the unread notification count.');
check(/loadUnreadNotificationCount/.test(read('src/core/notifications/notifications-service.ts')), 'Unread count loader missing.');

if (failures.length) {
  console.error('Notifications/inquiry audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Notifications/inquiry audit passed: idempotent server-created notifications, read-only client updates, real inquiry states, partner-only received/seen/reply, no fake push.');
