# Isolated DEV apply — four October 17 Mobile V1 migrations

**Status:** PROPOSAL ONLY — **not authorized to execute**
**Project:** `fairpath-mobile-dev` · `znvhmuhojvwvjzmaqwff`
**Branch / commit:** `development/mobile-v1-completion` @ `231de92`
**Phase A (2026-10-20):** Consent profile sync and experience column are missing; existing owner RLS policies are present but the initplan optimization is missing.
**Scope boundary:** Apply **only** the four SQL files below. **Do not** `db push` the full chain, **do not** `migration repair` for the 22 local-only versions, **do not** touch production (`rqpczemdagoddhuwefxt`).

---

## 1. Files to apply (strict order)

Run in this order in the DEV SQL editor (or a single scripted transaction if your runbook allows). Paths are repo-relative.

| Order | Version | File |
| ---: | --- | --- |
| 1 | `20261017193000` | `supabase/migrations/20261017193000_record_document_consent_sync_profiles.sql` |
| 2 | `20261017201000` | `supabase/migrations/20261017201000_profiles_experience_summary.sql` |
| 3 | `20261017200000` | `supabase/migrations/20261017200000_member_record_statements_rls_initplan.sql` |
| 4 | `20261017202000` | `supabase/migrations/20261017202000_rls_initplan_saved_searches_inquiries.sql` |

**Dependencies (already on DEV):** `20261015130000_record_document_consent.sql`, `profiles`, `consent_events`, `member_record_statements` (`20261016220000`), `saved_job_searches` (`20261016140000`), `housing_inquiry_messages` (`20261016130000`).

---

## 2. Why not `supabase db push`

`npx supabase migration list --linked` shows **26** local-only versions (22 + these 4). A push would attempt **all 26** in migration order, starting with notification/relief/staffing files that **overlap** DEV-applied `_v2` timestamps.

**Isolated apply = manual SQL (or a one-off operator script) for the four files only.**

---

## 3. Preflight (read-only — repeat immediately before apply)

Run in [DEV SQL editor](https://supabase.com/dashboard/project/znvhmuhojvwvjzmaqwff/sql). Expect the same results as Phase A.

```sql
-- P1: Linked project (operator sanity)
select current_database();

-- P2: Consent RPC must NOT yet update profiles (pre-state)
select (pg_get_functiondef(p.oid) ilike '%update public.profiles%') as updates_profiles
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'record_document_consent';

-- P3: Column absent
select count(*) as experience_summary_cols
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'experience_summary';

-- P4: Policies use bare auth.uid() (pre-state sample)
select c.relname, p.polname, pg_get_expr(p.polqual, p.polrelid) as qual
from pg_policy p
join pg_class c on c.oid = p.polrelid
where c.relname in ('member_record_statements', 'saved_job_searches', 'housing_inquiry_messages')
  and p.polcmd in ('r', '*')
order by 1, 2;
```

**Go criteria:**

| Check | Expected before apply |
| --- | --- |
| P2 `updates_profiles` | `false` |
| P3 `experience_summary_cols` | `0` |
| P4 qual text | contains `auth.uid()` **without** `(select auth.uid())` on the four member_record_statements policies and saved-job / inquiry thread policies |

**Repo preflight (operator machine, no cloud):**

```powershell
cd fairpath-mobile
git checkout development/mobile-v1-completion
git pull
git rev-parse HEAD   # expect 231de92 or later containing these four files

npm run test:sql:consent
npm run typecheck
```

`test:sql:consent` applies **all** migrations locally (PGlite) including `17193000` — it is a **behavioral dry-run** of the consent change, not a DEV dry-run.

**CLI dry-run note:** Supabase CLI has **no** “apply single migration to remote without history” flag. The DEV preflight is read-only and is **not a dry-run of applying the SQL**. An explicitly authorized transaction can use `BEGIN` … review … `COMMIT`** (or run file-by-file and verify after each).

---

## 4. Execution procedure (authorized operators only)

1. Confirm dashboard project name **fairpath-mobile-dev** and ref **`znvhmuhojvwvjzmaqwff`**.
2. Optional: note current time and request a DEV backup/snapshot per org policy.
3. Open SQL editor → new query.
4. Paste and run **file 1** entirely → confirm success (no error).
5. Run **post-step verify** for file 1 (§5.1).
6. Repeat for files 2, 3, 4 in order.
7. Run full **post-apply verification** (§6).
8. Record operator log: date, operator, git SHA, four files applied, pre/post query snippets (no secrets).

**Do not** run `supabase db push`, `supabase migration repair`, or `db reset`.

---

## 5. Per-step verification (during apply)

### 5.1 After `20261017193000`

```sql
select (pg_get_functiondef(p.oid) ilike '%update public.profiles%') as updates_profiles,
       (pg_get_functiondef(p.oid) ilike '%terms_accepted_at%') as sets_terms
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'record_document_consent';
```

Expect: `updates_profiles = true`, `sets_terms = true`.

Optional functional check with a **DEV test user** (not production):

```sql
-- Replace <uid> with dev-free or disposable test member
select terms_accepted_at, terms_accepted_version from public.profiles where id = '<uid>';
-- After member completes accept-terms in app OR test RPC as that user via authenticated session:
-- terms_accepted_at and version should be non-null
```

### 5.2 After `20261017201000`

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'experience_summary';
```

Expect: one row, `text`.

### 5.3 After `20261017200000`

```sql
select polname, pg_get_expr(polqual, p.polrelid) as qual
from pg_policy p join pg_class c on c.oid = p.polrelid
where c.relname = 'member_record_statements'
order by polname;
```

Expect: all four owner policies contain `(select auth.uid())`.

### 5.4 After `20261017202000`

```sql
select c.relname, p.polname, pg_get_expr(p.polqual, p.polrelid) as qual
from pg_policy p join pg_class c on c.oid = p.polrelid
where c.relname in ('saved_job_searches', 'housing_inquiry_messages')
  and p.polname in (
    'Users read own job searches', 'Users create own job searches',
    'Users update own job searches', 'Users delete own job searches',
    'Member reads own inquiry thread'
  );
```

Expect: qual expressions use `(select auth.uid())`.

---

## 6. Post-apply test plan

### 6.1 SQL (DEV editor)

Ledger + profile sync (from `docs/DEV_SUPABASE_MOBILE_V1_MIGRATIONS.md`):

```sql
select terms_accepted_at, terms_accepted_version, privacy_accepted_at, privacy_accepted_version
from public.profiles where id = '<test_user_id>';

select event_type, document_version, granted, created_at
from public.consent_events
where user_id = '<test_user_id>' and event_type in ('terms_accepted', 'privacy_accepted')
order by created_at desc limit 4;
```

### 6.2 App (DEV + `.env.local`)

1. Sign in as DEV test account → complete **`/accept-terms`** once.
2. Force-quit / reload → must **not** loop back to accept-terms (`docs/AUTH_E2E_BROWSER_CHECKLIST.md`).
3. Onboarding step 2 → optional experience line → save → confirm no error (column populated if provided).
4. Smoke: `/saved-job-searches`, housing inquiry thread read (RLS still allows owner).

### 6.3 Repo (local, no DEV keys required)

```powershell
npm run test:sql:consent
npm run test:onboarding
npm run test:auth
```

Optional full gate: `npm run test:all` (65 checks).

---

## 7. Migration history implications

| Topic | Effect |
| --- | --- |
| `supabase migration list` | **Unchanged** for these four: local versions still show **remote empty** until a separate **history reconciliation** project runs. |
| This isolated apply | **Schema matches** repo intent for Oct 17; **history table does not**. |
| Future `db push` | Still **blocked** (22 + 4 pending from CLI’s view). Even after manual apply of 4, CLI may still try to re-apply them unless repaired — **do not push** until reconciliation is approved. |
| Idempotency | File 2 uses `add column if not exists`. Files 3–4 use `drop policy if exists` + recreate. File 1 replaces function — re-running file 1 is safe. |
| Drift detection | Operators should treat **“Phase A post-check queries”** as source of truth for Oct 17, not migration history rows. |

**Optional later (separate approval, not part of this proposal):**
`supabase migration repair --status applied` for **only** `20261017193000` … `20261017202000` after manual apply — still **without** repairing the 22.

---

## 8. Rollback strategy

Execute only if Oct 17 apply causes a regression and rollback is explicitly approved.

| Step | Rollback action |
| --- | --- |
| **R1 — Consent RPC** | Redeploy function body from `supabase/migrations/20261015130000_record_document_consent.sql` (ledger-only insert). Profile pointers already set remain; no automatic undo of consent data. |
| **R2 — Column** | **Preserve the column and its data by default.** Do not drop it during routine rollback. Any later removal requires a separate approved data-export, dependency audit, and retention decision. |
| **R3 — member_record_statements RLS** | Re-run policy definitions from `supabase/migrations/20261016220000_record_statement.sql` (bare `auth.uid()`). |
| **R4 — saved searches + inquiry thread RLS** | Re-run policies from `20261016140000_saved_job_searches.sql` and `20261016130000_housing_inquiry_followups.sql`. |

After rollback, re-run Phase A preflight queries to confirm pre-state.

**History table:** Manual SQL rollback does **not** remove migration history rows (none were added for this path). The four versions will still appear pending after manual apply; never run `db push` until separately reconciled.

---

## 9. Risk summary

| Risk | Mitigation |
| --- | --- |
| Wrong project | Dashboard ref + preflight P1 |
| Full chain push | **Forbidden** in this proposal; manual four-file only |
| 22 migrations re-applied | No push / no repair of 22 |
| Consent behavior change | Expected; test accept-terms loop post-apply |
| RLS initplan change | Behavior-preserving for same user; performance-only in typical paths |
| CLI thinks Oct 17 still pending | Documented; use SQL verification, not list alone |

---

## 10. Approval checklist (sign-off before execution)

- [ ] Operator confirms project **`znvhmuhojvwvjzmaqwff`**
- [ ] Phase A preflight re-run with expected pre-state
- [ ] DEV backup/snapshot policy satisfied (if required)
- [ ] Four files copied from git SHA **`____________`**
- [ ] Explicit approval recorded (ticket / PR comment / runbook sign-off)
- [ ] Post-apply §6 completed and logged

**Authorization line:** _________________________ Date: __________

---

## Related documents

- `docs/DEV_MIGRATION_RECONCILIATION_2026-10-20.md` — full drift matrix, **NO-PUSH** for 26-version chain
- `docs/DEV_SUPABASE_MOBILE_V1_MIGRATIONS.md` — accept-terms verify queries
- `docs/P0_P1_DEFECT_REGISTER.md` — P0-001
