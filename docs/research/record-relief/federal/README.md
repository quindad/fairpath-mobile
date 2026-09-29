# Federal Record Relief research

Place `FEDERAL_CANDIDATE_PACKAGE_V1.md` and `FEDERAL_CANDIDATE_PACKAGE_V1_1_RED_TEAM.md` here when they arrive.

Federal is a real, distinct `record_relief_jurisdictions.kind = 'federal'` jurisdiction (`US-FED`), never modeled
as a fake state — pathways live in `record_relief_federal_pathways`, not `record_relief_rules`, and are routed
through a separate evaluation branch. Each pathway must be tagged with an explicit `pathway_type`
(`pardon`/`commutation`/`remission`/`reprieve`/`judicial_expungement`/`statutory_relief`/
`firearm_rights_restoration`/`other`) — see `docs/RECORD_RELIEF_RESEARCH_AGENT_CONTRACT.md`. A pardon is never
an expungement; firearm-rights restoration is never a pardon; commutation is never a pardon.
