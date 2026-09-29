# Migration history audit

DEV is the only place these are applied — nothing here has ever touched production. Nothing in this doc is a
recommendation to rewrite applied DEV history tonight. It's a map for building a sane production migration chain
later.

## Categories

| File | Purpose | DEV applied | Production applied | Keep? | Squash before production baseline? | Replacement plan |
|---|---|---|---|---|---|---|
| `20261001100000_resources_core.sql` through `20261002110000_meetings.sql` | Real product schema (Resources, Opportunity Profile, Documents, Privacy, Credit, Record Relief, AI provenance, Reminders, Resume Studio, Meetings) | Yes | No | **Keep** | No — this is the real product schema, not choreography | N/A — this IS the baseline going forward |
| `20261003100000_coverage_markets.sql` | Real product schema (Early Access / coverage markets) | Yes | No | **Keep** | No | N/A |
| `20261003110000_dev_early_access_lifecycle_seed.sql` | **DEV fixture / test choreography** — seeds one fictional TEST market to prove the Early Access lifecycle on real DEV | Yes | No | Keep in DEV history; **omit from a production baseline** | **Yes, squash candidate** | A production baseline should never carry test-market seed rows — this is disposable scaffolding that did its job |
| `20261003120000_dev_early_access_lifecycle_activate.sql` | **Temporary activation** — activates the TEST market (ran once under the pre-fix buggy code, correctly found zero matches) | Yes | No | Keep in DEV history (it's part of the story of how the bug was found); **omit from production baseline** | **Yes** | Same as above |
| `20261003130000_fix_activation_late_bound_enrollments.sql` | **Real security/correctness fix** — `activate_coverage_market()` now matches by ZIP-prefix at activation time instead of a stale enroll-time snapshot | Yes | No | **Keep, this is real product code** | No | This IS the correct version of the function going forward — a production baseline just needs the FINAL version of `activate_coverage_market`, achieved by keeping this migration (or, in a squashed baseline, by defining the function once in its final form) |
| `20261003140000_dev_early_access_lifecycle_reactivate.sql` | **Temporary activation** — re-runs activation after the fix, proving it now works | Yes | No | Keep in DEV history; **omit from production baseline** | **Yes** | Same choreography-squash treatment |
| `20261003150000_dev_early_access_lifecycle_cleanup.sql` | **Temporary cleanup** — removes the TEST market and its effects, restores the real DEV member's state | Yes | No | Keep in DEV history; **omit from production baseline** | **Yes** | Same |
| `20261003160000_record_relief_review_metadata.sql` | Real product schema (adds `next_review_at`/`researched_by`/`reviewed_by`/`staff_notes`) | Yes | No | **Keep** | No | N/A |
| `20261003170000_record_relief_active_rules_grant_fix.sql` | **Real security fix** — revokes an over-broad RPC grant | Yes | No | **Keep, this is the correct final grant state** | No | Same reasoning as the activation fix: a squashed baseline needs the FINAL grant state, which this migration IS |
| `20261003180000_record_relief_column_grant_fix.sql` | **Real security fix** — column-scoped grants excluding staff-only fields | Yes | No | **Keep, this is the correct final grant state** | No | Same |

## The pattern worth naming

Five consecutive migrations (`110000` through `150000`) exist purely to prove one feature's lifecycle end-to-end
against real DEV state, using the Supabase CLI's `db push` as a way to run privileged SQL without a service-role
REST key. That was the right call for tonight's verification goal, but it means the DEV migration history now
contains a real "seed → activate (buggy) → fix → reactivate → cleanup" story mixed into what should eventually be
clean product schema history.

## Production baseline strategy (documented, not executed)

The safe path, whenever a production baseline is actually needed:
1. **Do not replay DEV's migration history onto production.** Production should get a fresh baseline generated
   from the CURRENT schema state (`supabase db dump --schema`), not a replay of every incremental migration
   including the temporary ones.
2. That baseline naturally excludes the seed/activate/reactivate/cleanup choreography migrations, because a
   schema dump only captures final state — the TEST market they created was already cleaned up, so it's simply
   not present in the dump. No manual squashing/rewriting of DEV migration files is needed to achieve this.
3. The two security-fix migrations (`170000`, `180000`) and the correctness fix (`130000`) are NOT "temporary" —
   they define the CORRECT final state of a function/grant. A schema dump captures their end result automatically
   (the current, fixed version of `activate_coverage_market()` and the current, correct grants), so there's
   nothing special to do for them either — they're just... correct, and the dump reflects that.
4. **This means no dangerous squash operation is actually needed.** The "squash candidates" flagged above resolve
   themselves the moment a real baseline is generated via schema dump rather than migration replay — flagging
   them here is about understanding WHY the DEV history looks the way it does, not about an action to take on it.

**Bottom line:** DEV's migration history is a legitimate, honest record of real work (including finding and fixing
two real bugs) — it doesn't need to be "cleaned up" defensively. When production launch approaches, generate its
baseline from a schema dump of DEV's current state, not by replaying this file list.
