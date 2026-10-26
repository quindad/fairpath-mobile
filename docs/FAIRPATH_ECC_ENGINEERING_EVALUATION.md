# FairPath ECC (Everything Claude Code) evaluation

**Official source:** [github.com/affaan-m/ECC](https://github.com/affaan-m/ECC) · [ecc.tools](https://ecc.tools)  
**License:** MIT (OSS core); ECC Pro GitHub App is paid for private repos.  
**Audit date:** 2026-10-26 · **No ECC hooks installed** (per mission).

## FairPath current engineering stack

| Layer | What exists today |
|-------|-------------------|
| IDE | **Cursor Ultra** (primary), Windows Mini PC |
| Repo rules | `AGENTS.md` (Expo v57 docs), user rules, `CLAUDE.md` pointer |
| Cursor config | `.cursor/settings.json` — `amazon-location-service` plugin enabled |
| Skills | User-level Cursor skills (`~/.cursor/skills-cursor/*`) — autopilot, canvas, share, etc. |
| QA | `npm run test:all` (122), `Run-DevAuthenticatedQa.mjs`, DEV scripts |
| MCP | Cursor dynamic tools (browser, origin, REA, Appwrite plugins as enabled) |
| Claude Code | Optional; not declared in repo |
| GitHub | `quindad/fairpath-mobile`, branch `development/mobile-v1-completion` |

## ECC product summary (from official README)

ECC is an **agent harness OS**: plan → test → implement → review → verify → remember → improve.

| Surface | Count / notes |
|---------|----------------|
| Agents | 71 specialized subagents |
| Skills | 311 (TDD, security, docs, ML, …) |
| Commands | 97 legacy shims (skills-first migration) |
| Packages | `ecc-universal`, `ecc-agentshield` (npm) |
| Plugin | `ecc@ecc` marketplace for **Claude Code** |
| AgentShield | Security scanning component |
| Harnesses | Native: Claude Code, Codex; **adapters:** Cursor, Gemini, Zed, Copilot, … (capability-limited) |

**Warning from ECC:** Install only from official channels; do not stack install methods on the same harness.

## Compatibility assessment — FairPath

### Aligns well

- **Regression-first** culture matches `122/122` gate and DEV QA scripts.
- **Security review** (`ecc-agentshield`) complements existing `audit-security.mjs`.
- **Research-first** fits open-source evaluation discipline.
- **Expo/Supabase** can use ECC `rules/typescript` + custom FairPath rule pack.

### Conflicts / duplicates (do not stack blindly)

| ECC capability | FairPath already has |
|----------------|---------------------|
| 71 agents | Cursor subagents (Bugbot, explore, ci-investigator) + user skills |
| 311 skills | `.cursor/skills-cursor/*`, project `AGENTS.md`, handoff docs |
| Hooks (Claude) | Cursor hooks skill available but **not installed** in repo |
| Memory / instincts | Cursor user store, chat history — separate systems |
| Full manual `./install.sh --profile full` | Would duplicate Cursor rules + overflow context |

### Cursor-specific (ECC README)

- ECC 2.2: **`ecc install --target cursor`** is a **managed adapter**, not full parity with Claude plugin.
- **Do not** run Claude `ecc@ecc` plugin **and** full ECC manual install **and** Cursor-native stack on same workflow without collision review.

## Recommended installation strategy

### Claude Code (if used on FairPath)

1. **One path only:** `npx ecc-universal@2.2.3 setup` **or** `/plugin install ecc@ecc` — not both + manual install.
2. Scope: **`local`** or **project** for FairPath repo; avoid duplicating user-global skills.
3. Hook profile: **standard** (not maximal) until iPhone acceptance completes.
4. Copy **only** `rules/common` + `rules/typescript` if needed; skip `--profile full`.

### Cursor Ultra (primary)

1. **Do not install ECC hooks into Cursor yet.**
2. **Selective adoption:**
   - Import **workflow ideas** (plan → test → verify) into existing user rules — already aligned.
   - Use Cursor **`review-bugbot`** / **`review-security`** skills instead of duplicating AgentShield locally.
   - Optionally run **`npx ecc-universal consult "security reviews" --target claude`** for ad-hoc advice — **do not** sync 311 skills into Cursor.
3. **FairPath engineering profile (Cursor)** — extend via `.cursor/rules` (future, scoped):

| Domain | Cursor behavior |
|--------|-----------------|
| Expo RN | Read Expo **v57** docs before native changes |
| Supabase | Migrations idempotent; RLS `(select auth.uid())`; no service role in client |
| Signal | Gateway stays auth orchestrator; credits before model |
| Record Relief | No LLM eligibility; jurisdiction engine authoritative |
| QA | Run `test:all` + `Run-DevAuthenticatedQa` before DEV deploy claims |
| iPhone | `development-signal` build; `:8083` Metro; journey doc |
| Security | `audit-security.mjs` + no secrets in repo |

### Backup before any ECC install (Claude machine)

```powershell
# Example — adjust paths
Copy-Item "$env:USERPROFILE\.claude" "$env:USERPROFILE\.claude.backup-ecc-$(Get-Date -Format yyyyMMdd)" -Recurse -ErrorAction SilentlyContinue
Copy-Item "$env:USERPROFILE\.cursor" "$env:USERPROFILE\.cursor.backup-ecc-$(Get-Date -Format yyyyMMdd)" -Recurse -ErrorAction SilentlyContinue
```

## AgentShield

- **Evaluate** via `ecc-agentshield` npm on **CI sample** (DEV branch) before enabling hooks.
- FairPath already has **`scripts/audit-security.mjs`** — AgentShield should **supplement**, not replace, migration/client audits.

## Installation plan (phased)

| Phase | Action | Status |
|-------|--------|--------|
| 0 | This audit + backup policy | **Done** |
| 1 | iPhone acceptance + Signal DEV stable | **In progress** |
| 2 | Claude Code: `npx ecc-universal@2.2.3 install --guided --harness claude --claude-scope local --profile core --dry-run` | Pending human |
| 3 | If dry-run clean: install **core** profile only | Pending approval |
| 4 | Cursor: add **FairPath rule file** (no ECC hook sync) | Pending |
| 5 | Optional ECC Pro GitHub App on **private** repos | Business decision ($19/seat/mo) |

## Rejected for now

- Installing **ecc@ecc** + **full manual ECC** + Cursor plugins simultaneously.
- Replacing `AGENTS.md` / handoff docs with ECC command shims.
- ECC hooks that run on every keystroke during Expo Metro sessions (risk to `:8083` stability).

## Definition of success (ECC)

FairPath keeps **Cursor Ultra** as the primary harness, uses **ECC selectively on Claude Code** (if at all) with **core profile**, preserves **122/122 + DEV QA**, and gains **structured review/security** without configuration collision or production risk.
