# Competitive Intelligence Research Package: Indeed
**Researcher:** Juice | **Date:** 2026-10-09
**Method:** Claude Browser pane, unauthenticated, public pages only.

## 1. Overview
Indeed is a general-purpose, massive-scale job search engine/aggregator — **not** a fair-chance specialist. This package is deliberately scoped tighter than Honest Jobs' because Indeed is a known-quantity generalist; the useful competitive signal is specifically *how it handles (or doesn't handle) fair-chance hiring*, plus its pricing model as a contrast point to Honest Jobs' flat-subscription model.

## 2. Feature inventory **[OBSERVED]**
- Free job posting (1 free post), **cost-per-click "Sponsored Jobs"** model for paid visibility — fundamentally different monetization from Honest Jobs' flat monthly subscription. Source: https://www.indeed.com/hire/cs
- Two paid tiers named **Standard** (priority placement, targeting by skills/certifications) and **Premium** (instant candidate matching, employer branding/logo on posts).
- Claims "380M sourceable Profiles" and that sponsored jobs are "90% more likely to report a hire."
- **No dedicated fair-chance/second-chance filter or matching feature exists.** Searching "second chance employer jobs" is a **plain keyword search** — confirmed by observing the actual results page, which mixes genuinely relevant postings (e.g., a peer support specialist role at a recovery nonprofit) with completely unrelated jobs (travel consultant, lounge concierge) that merely matched the text somewhere. There is no conviction-compatibility signal, no verified fair-chance-employer badge, nothing resembling Honest Jobs' Conflix. **[OBSERVED]** (https://www.indeed.com/q-second-chance-employer-jobs.html)
- Individual employer job postings can voluntarily disclose fair-chance-ordinance compliance language (e.g., a DoorDash posting observed citing the San Francisco Fair Chance Ordinance and LA Fair Chance Initiative) — this is **employer-authored content**, not an Indeed platform feature.
- Observed one posting disclosing use of a third-party AI hiring/interview tool ("Fountain") with NYC Local Law 144 bias-audit disclosure — again, employer-side tooling riding on top of Indeed, not an Indeed-native feature. Noted because AI-hiring-bias disclosure requirements are a relevant compliance pattern if FairPath ever builds employer-side tooling.

## 3. FairPath comparison
| Indeed capability | FairPath | Gap classification |
|---|---|---|
| Massive job aggregation scale | FairPath's job board is seeded/DEV-test data in this engagement; real-world scale unknown to me | Not a meaningful 1:1 gap — different business model (aggregator vs. curated fair-chance platform) |
| CPC sponsored-visibility pricing | Not applicable — FairPath has no employer monetization observed | N/A |
| **No fair-chance specialization** | FairPath is purpose-built for this population | **FairPath advantage**, not a gap — worth stating plainly: Indeed's scale is not a threat on specialization, only on raw volume/reach. |

## 4. Recommendation
Indeed is not a template to copy from for fair-chance features — it confirms there's a real, unclaimed niche (conviction-compatibility matching + verified fair-chance employer trust signal) that neither Indeed nor its scale has addressed. The actionable takeaway is strategic, not technical: **Honest Jobs' Conflix-style matching remains the right thing to build**, because even the dominant generalist player hasn't done it. No new UI/backend recommendations beyond what the Honest Jobs package already specified.

## 5. Source links
- https://www.indeed.com/
- https://www.indeed.com/hire/cs
- https://www.indeed.com/q-second-chance-employer-jobs.html

## 6. Not covered this pass
- Indeed's actual employer dashboard (requires account creation/login — not attempted).
- Indeed's resume database / candidate-sourcing product (separate from job posting).
- Indeed's ATS integrations.
