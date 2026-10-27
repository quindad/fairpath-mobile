# DEV migration reconciliation — Sprint 1 (proposal only)

**Project:** `znvhmuhojvwvjzmaqwff`  
**Date:** 2026-10-26  
**Status:** Read-only analysis — **do not apply without explicit approval**

## Summary

| Drift type | Count (approx.) | Risk |
|------------|-----------------|------|
| **Remote-only** migration versions (not in repo) | **37** | Blocks `db push --dry-run` (`DbPushMissingLocalError`) |
| **Local-only** versions (not on DEV) | **~30+** | App/RPC features in repo may be missing on DEV |
| **Matched** | Majority through `20261026220000` | Baseline OK |

CLI evidence:

```text
supabase db push --linked --dry-run
→ Remote migration versions not found in local migrations directory.
→ Suggested repair: supabase migration repair --status reverted <37 versions>
```

## Phase A — Repair migration history (operator, DEV only)

Mark **remote-only orphan versions** as reverted so local history can advance. CLI suggested list (2026-10-26):

`20261007233711`, `20261007233719`, `20261007233732`, `20261007233744`, `20261007234149`, `20261007234156`, `20261007234207`, `20261007234223`, `20261007234241`, `20261007234247`, `20261008000024`, `20261008000033`, `20261008000044`, `20261008000053`, `20261008000916`, `20261008002322`, `20261008002334`, `20261008003911`, `20261008003916`, `20261008003948`, `20261008003957`, `20261008004003`, `20261008004014`, `20261008004024`, `20261008004033`, `20261008004455`, `20261008004503`, `20261008004558`, `20261008004658`, `20261008025335`, `20261008031954`, `20261008035711`, `20261008041437`, `20261008175923`, `20261008192257`, `20261008460000`, `20261008470000`, `20261008480000`, `20261008490000`, `20261008500000`, `20261008510000`, `20261015032752`, `20261021205913`

**Command template (approval required):**

```bash
npx supabase migration repair --status reverted <space-separated versions above>
```

Then re-run `npx supabase migration list --linked` until remote-only rows are cleared.

## Phase B — Apply local-only migrations (ordered)

After Phase A, run **dry-run** again:

```bash
npx supabase db push --linked --dry-run
```

**Local-only versions observed** (empty `remote` in migration list — apply in timestamp order after repair):

| Version | Notes |
|---------|--------|
| `20261008222300`, `20261008222400` | Program scout / verify chain |
| `20261008520000` … `20261008590000` | Record relief / scout batch |
| `20261009010000` … `20261009080000` | Housing / jobs follow-ups |
| `20261014000000` … `20261014020000` | Mid-October batch |
| `20261017193000` … `20261017202000` | Document consent / profile sync |

**Approval gate:** Review each file under `supabase/migrations/` for the above versions before push.

**Command template (approval required):**

```bash
npx supabase db push --linked
```

## Phase C — Edge Functions (DEV deploy proposal)

Deploy when app code references changed behavior (Sprint 1 Signal):

| Function | Reason |
|----------|--------|
| `fairpath-ai-gateway` | Multi-need resource relevance (deployed prior session; re-deploy if `_shared/signal` changed again) |
| `credit-report-explanation` | Plain-text / settled-account prompt (local change; **not deployed** this sprint) |

```bash
npx supabase functions deploy fairpath-ai-gateway --project-ref znvhmuhojvwvjzmaqwff
npx supabase functions deploy credit-report-explanation --project-ref znvhmuhojvwvjzmaqwff
```

## Phase D — Post-apply verification

1. `node scripts/qa-dev-edge-inventory.mjs`
2. `node scripts/Run-DevAuthenticatedQa.mjs` (with vault creds)
3. `node scripts/qa-dev-public-search-endpoints.mjs`
4. Spot-check RLS: `test:sql:cross-member-isolation` (local) + DEV smoke

## App features likely affected by local-only gap

- My Path / `member_opportunity_plan_items` (if migration in local-only set)
- Community exchange draft tables (`docs/proposed-migrations/` — separate from main chain)
- Consent sync (`20261017193000` local-only on DEV)

Cross-check: `docs/FEATURE_BACKEND_MATRIX.md`, `scripts/audit-member-capabilities.mjs`.

## Storage

No new buckets proposed in Sprint 1. Existing: `credit-uploads` (private), document buckets per security audit.

---

**Next operator action:** Approve Phase A repair list, then dry-run Phase B and paste pending migration filenames for legal/RLS review.
