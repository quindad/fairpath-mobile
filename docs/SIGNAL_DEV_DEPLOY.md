# Signal — DEV deploy runbook

**Project ref:** `znvhmuhojvwvjzmaqwff`  
**Branch:** `development/mobile-v1-completion`

Signal = member-facing AI Edge Functions invoked from `src/core/ai/signal.ts`. Provider keys **never** ship in the mobile app; they live in Supabase Edge secrets only.

## Preflight (local, no cloud)

```powershell
npm run test:signal-deploy
npm run deploy:signal:dev -- --dry-run
```

Dry-run must print project **`znvhmuhojvwvjzmaqwff`**. On Windows, `npm` can inject extra argv; the deploy script ignores non-ref tokens and falls back to `FAIRPATH_DEV_PROJECT_REF` or the DEV ref above. Override explicitly: `node scripts/deploy-dev-signal.mjs znvhmuhojvwvjzmaqwff --dry-run`.

## Edge secrets (DEV)

Set **at least one** provider key (chain skips missing providers):

| Secret | Required | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | One of three | Quality-tier fallback |
| `OPENAI_API_KEY` | One of three | Vision + text |
| `GOOGLE_API_KEY` or `GEMINI_API_KEY` | One of three | Fast tier default |
| `SIGNAL_MODEL` | Optional | Shared model override |
| `SIGNAL_MODEL_ANTHROPIC` / `_OPENAI` / `_GOOGLE` | Optional | Per-provider override |

Supabase injects `SUPABASE_URL` and `SUPABASE_ANON_KEY` automatically for deployed functions.

```powershell
supabase login
supabase link --project-ref znvhmuhojvwvjzmaqwff
supabase secrets set ANTHROPIC_API_KEY=*** OPENAI_API_KEY=*** GOOGLE_API_KEY=***
# Or set keys individually in Dashboard → Project Settings → Edge Functions → Secrets
```

## Deploy (17 functions)

```powershell
npm run deploy:signal:dev
# Or explicit ref:
node scripts/deploy-dev-signal.mjs znvhmuhojvwvjzmaqwff
```

Functions: `job-fit-explanation`, `cover-letter-draft`, `letter-explainer`, `interview-prep`, `housing-fit-explanation`, `housing-application-prep`, `resource-guidance`, `member-focus-guidance`, `resume-bullet-draft`, `dispute-letter-draft`, `credit-report-explanation`, `record-relief-explanation`, `veteran-experience-translation`, `academy-lesson-question`, `business-idea-feedback`, `meeting-prep`, `marketplace-listing-draft`.

## Live DEV deploy (operator)

From repo root with Supabase CLI logged in and DEV linked:

```powershell
npm run deploy:signal:dev
```

All **17** functions target project `znvhmuhojvwvjzmaqwff`. Dashboard: [Edge Functions](https://supabase.com/dashboard/project/znvhmuhojvwvjzmaqwff/functions).

Provider keys are **not** in git — set in Dashboard → Edge Functions → Secrets before expecting model-generated text (otherwise members see honest fallbacks, not crashes).

## Smoke test (signed-in DEV member)

1. Sign in as `dev-plus@fairpath.test` (Signal credits on server).
2. Open a **published** job → **Why might this job fit me?** → expect text or honest fallback (not a crash).
3. `/letter-explainer` with a clear photo → vision tier if OpenAI/Google key present.
4. Out of credits → **402** → client shows `out_of_credits` (`signal.ts`).

## Related

- `docs/EXTERNAL_INTEGRATION_REGISTER.md` — integration status board  
- `src/core/ai/signal-catalog.ts` — member-facing workflow map  
- `npm run test:ai` — deterministic Assistant (client); separate from Edge Signal  
