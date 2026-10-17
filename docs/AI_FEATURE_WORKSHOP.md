# FairPath AI workshop (Signal)

This is the working doc for **where AI belongs in FairPath**, what is **already built**, what to **turn on with keys**, and what to **build next**. FairPath is for everyone; the best AI features help people on tight budgets **without** paywalling jobs, housing, resources, or record relief.

## Rule zero: where the API key goes

**Do not put Anthropic/OpenAI keys in the Expo app or `EXPO_PUBLIC_*`.** Anyone could extract them from a phone build.

FairPath Signal runs like this:

1. Member taps **Signal** in the app.
2. App calls a **Supabase Edge Function** with the member’s JWT.
3. Function calls **`spend_ai_credits`** (rate limit + balance).
4. Function calls a **model provider** (today mostly Anthropic in code; gateway supports OpenAI + Google too).
5. App shows text after **promise guards** (no guaranteed score, approval, or expungement).

### Keys you actually need

| Secret | Where it lives | Purpose |
|--------|----------------|---------|
| `ANTHROPIC_API_KEY` | Supabase Edge Function secrets | Primary or fallback hop |
| `OPENAI_API_KEY` | Same | Cheaper/faster hops (e.g. GPT-4o-mini for short tasks) |
| `GOOGLE_API_KEY` or Vertex | Same | Gemini for vision / long context when wired |
| `SIGNAL_MODEL` / per-provider model env | Same | e.g. `SIGNAL_MODEL_ANTHROPIC`, `SIGNAL_MODEL_OPENAI`, `SIGNAL_MODEL_GOOGLE` |
| `EXPO_PUBLIC_SUPABASE_URL` / `ANON_KEY` | `.env.local` | App talks to DEV project |
| Provider keys for **extraction** | Supabase secrets | `extract-credit-report` (separate privacy decision) |

After secrets are set: **deploy** the functions in `supabase/functions/*` to DEV (`supabase functions deploy …`).

Give test members credits with **`grant_ai_credits`** (service role only) until monthly grants are wired to billing.

---

## What already exists (mobile + server)

The app already ships **15+ Signal workflows** (see `src/core/ai/signal-catalog.ts`). Examples:

| Member moment | Where in app | Edge function |
|---------------|--------------|---------------|
| Job fit | Job detail | `job-fit-explanation` |
| Interview prep | Job application | `interview-prep` |
| Housing fit | Home detail | `housing-fit-explanation` |
| Application prep | Housing application | `housing-application-prep` |
| Credit report / item | Credit Studio | `credit-report-explanation` |
| Dispute letter draft | New dispute | `dispute-letter-draft` |
| Record relief explain | Case detail | `record-relief-explanation` |
| Resume bullets | Resume editor | `resume-bullet-draft` |
| Focus / resources | My Path, Assistant | `member-focus-guidance`, `resource-guidance` |
| Veterans translation | Veterans | `veteran-experience-translation` |
| Marketplace listing | List item | `marketplace-listing-draft` |
| Startup feedback | Entrepreneurship | `business-idea-feedback` |

**Assistant** (`/fairpath-ai`) adds **free deterministic** answers first; some intents merge Signal when signed in.

Until DEV has **`ANTHROPIC_API_KEY` + deployed functions + credits**, taps return fallback or “out of credits” — the UI is ready.

---

## Workshop: features worth adding next

Prioritized for **impact**, **ethics**, and **reuse of existing gateway**.

### Tier A — Ship soon (high value, fits mission)

1. **Cover letter draft (per job)** — **Live:** `cover-letter-draft` Edge Function (`job_writer`), job detail → **Draft cover letter** (2 credits).
2. **“Explain this letter in plain English”** — **Live:** `letter-explainer` (`document_vision`), `/letter-explainer` (photo; 2 credits). Not legal advice.
3. **Application review coach** — Before submit on job/housing: “Here’s what you entered; here’s what’s missing.” Mostly rules + optional Signal for wording. No auto-submit.
4. **Credit utilization coach** — Already have calculator; Signal explains **their numbers** and realistic paydown order (no score prediction).
5. **Signal catalog in app** — Done in Assistant: discoverability so members know what AI can do **on which screen**.

### Tier B — Differentiation (still honest)

6. **Weekly focus digest (push later)** — One `member-focus-guidance` run → notification when push exists.
7. **Academy lesson Q&A** — `academy-lesson-question` exists; wire in Academy lesson UI if not already everywhere.
8. **Resource scout** — Background worker finds programs; **human review** before showing as “verified.” (`resource-scout-worker` — ops heavy.)
9. **Easy Apply attachment helper** — Suggest which resume version matches job; member picks.

### Tier C — Revenue-aligned (after credits + Plus work)

10. **Higher monthly Signal bucket for FairPath+** — Wire `grant_ai_credits` to subscription webhook.
11. **One-time credit packs** — Store IAP → webhook → `purchase` ledger reason.
12. **Institution-sponsored credits** — Correctional / partner grants (schema exists).

### Do not build (or only with extreme care)

- **Auto-dispute sending** — Member must send; FairPath prepares.
- **“Your score will rise by X”** — Blocked by policy.
- **AI-only eligibility for record relief** — Rules engine decides; AI explains only.
- **ChatGPT-style open chat without workflow** — Expensive, hard to guard; keep workflow-bound Signal.

---

## Suggested credit economics (starting point)

| Tier | Monthly Signal credits (idea) | Notes |
|------|-------------------------------|--------|
| Free | 5–10 | Taste of value; global daily cap stays on server |
| FairPath+ | 30–50 | When billing connects |
| Pack | +20 one-time | Optional IAP |

Most workflows cost **1 credit**; dispute letter draft **2**. Tune from real Anthropic cost after DEV metrics.

---

## Your checklist to “feel AI live” in Expo Go

1. `.env.local` → DEV Supabase URL + anon key.
2. Supabase DEV → Secrets → `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY` (or `GEMINI_API_KEY`) — at least one required for model-assisted replies.
3. Deploy Signal functions (including `cover-letter-draft`, `letter-explainer`, and the rest under `supabase/functions/`).
4. SQL: grant yourself credits (`grant_ai_credits` via service role / SQL editor).
5. `npx expo start` → sign in → Job detail → **Ask Signal** or Assistant catalog.

---

## Multi-provider routing (you have Anthropic, OpenAI, Google, etc.)

The gateway in `supabase/functions/_shared/core/ai-gateway/gateway.ts` defines **`openai` | `anthropic` | `google`**, failover on 429/5xx, and **per-workflow** chains. Member Signal functions use **`resolveSignalChain()`** in `signal-chains.ts` (`fast` | `quality` | `vision` tiers) based on whichever secrets are set.

**Smart setup for margin at $2–5/mo:**

| Task type | Suggested routing | Why |
|-----------|-------------------|-----|
| Short explainers (job fit, credit item) | Google Gemini Flash or OpenAI mini **first**, Anthropic fallback | Cents matter at volume |
| Dispute / resume drafts | Anthropic or GPT-4 class **first** | Quality on editable drafts |
| Document / letter vision | Google or OpenAI vision | Capability match |
| Sensitive credit PDF | One approved provider only; no failover to random vendors | Privacy |

All keys stay in **Supabase secrets**. Optional overrides: `SIGNAL_MODEL` or `SIGNAL_MODEL_ANTHROPIC` / `_OPENAI` / `_GOOGLE`.

**Member never sees the vendor** — they see Signal credits spent and the same safety guards.

---

## Make $2–5 feel obvious (without lying)

FairPath+ should be framed as **“personal coach + more runs”**, not “unlock jobs.”

| Benefit | Why it feels worth $2 |
|---------|------------------------|
| **30–50 Signal credits/mo** vs ~5–10 free | Interview prep + dispute draft + weekly focus = real sessions |
| **7 Marketplace claims** | Tangible savings on goods |
| **Pack add-on later** | “I’m applying hard this month” burst |

**Free tier must stay generous enough** that a broke member still gets record relief, resources, credit tools, and *some* Signal — Plus is **more depth**, not survival.

AI features that sell Plus ethically:

1. **Weekly focus plan** (Signal) — “here’s your week” from *their* data  
2. **Cover letter + resume bundle** per job search sprint  
3. **Dispute letter drafts** (2 credits) — saves hours; still self-send  
4. **Interview prep unlimited-ish** within credit bucket  

---

## When there are no jobs or homes nearby

Inventory will be thin in many ZIPs early. The app must **not feel empty** — it should feel like **“FairPath is still my reentry OS.”**

**Always-on reasons to open the app (no listing required):**

- **Resources** — local/national help (food, shelter, ID)  
- **Record Relief** — state checker + filing steps  
- **Credit Studio** — upload/enter report, disputes, Signal explain  
- **Resume Studio** — ready before the market catches up  
- **Signal / My Path** — focus and next steps from profile + activity  
- **Early Access waitlist** — honest “we’re building your market”  
- **Academy / Entrepreneurship / Veterans / Pathways** — skill and identity work  

**Product rule:** empty job/housing screens should point to **`THIN_MARKET_ACTIONS`** (see `src/core/product/thin-market-value.ts`), not only “check back later.”

---

## How we iterate

Pick **one Tier A item** per sprint. Implement: Edge Function → `signal.ts` client → one screen button → audit/guard tests. Update this doc when a row moves to “live in DEV.”
