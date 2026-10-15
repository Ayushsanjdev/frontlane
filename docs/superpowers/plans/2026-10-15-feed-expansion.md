# Free Feed Expansion Implementation Plan

**Goal:** Populate Explore collections using all eligible source inventory, expand free public feeds and support three daily refreshes.
**Approved scope:** The user's instruction to build the five-step feed expansion recommendation and increase refresh frequency without paid services.
**Architecture:** Existing transactional ingestion and source registry; public Ashby and verified employer-specific adapters; shared collection selection and source health; existing external cron-job.org scheduling.

## Decisions and constraints
- Work in the existing checkout, preserving all prior uncommitted changes and local environment values.
- Keep the round-robin 50-role batch as featured inventory. Full successful employer snapshots publish every eligible available role and store the featured flag separately. Failed/truncated snapshots preserve existing jobs; research cannot replace employer snapshots.
- Add Ashby and an Amazon adapter only for verified accessible official feeds. No paid APIs or speculative sources. Update provider validation and schema transactionally.
- Classify all existing seeded employers against official company evidence; add catalog entries for verified new boards. Keep unknowns unknown.
- Explore/company collections include eligible remote aggregator jobs; ordinary /jobs and /jobs/remote retain their distinction. Deduplicate source copies consistently.
- Display latest successful check and source availability, distinguishing unconfigured, failed and zero-match sources. Daily emails remain once per day through existing campaign idempotency.
- Employer schedule: 08:00, 16:00 and 00:00 IST (`30 2,10,18 * * *` UTC). Remote offset: 08:30, 16:30 and 00:30 IST. External cron is free; hosting/database quotas still apply. Never activate a second competing scheduler.
- No new environment variables expected. Any required additions must go into local .env.local and .env.example as well as deployment instructions; never print secrets.

## Tasks
- [x] Add failing integration tests for full inventory + featured filtering, source isolation and closure, Ashby/Amazon normalization, Explore remote inclusion, feed health and provider registry migration.
- [x] Implement inventory and provider support; verify official new boards; expand exact catalog mappings.
- [x] Integrate collection feed status and truthful source/check dates; update operational docs and schedule tooling.
- [x] Run migrations and an initial verified source refresh against configured data after checks, without deployment or paid services.
- [x] Run full tests, typecheck, build, responsive checks and independent review. Report whether the actual external scheduler could be updated, separately from code/documentation changes.

## Verified outcome
- Migration applied through the configured local environment. Initial refresh checked 54 registered boards: 93 eligible employer roles, zero source failures; three remote feeds checked successfully (one matching WWR role). Total active inventory: 114, including 43 employer roles outside the featured selection.
- Existing cron-job.org job 8632316 saved and verified enabled at `30 2,10,18 * * *`. Remote scheduler remains unconfigured until the new endpoint is deployed. Existing automatic email retries were not modified.
- 167 tests passed, typecheck and production build passed. Final review regression: 21 focused tests passed, including notifications for nonfeatured full-snapshot roles. Independent review found the publication-event issue, now fixed.
- Local production preview verified FAANG's two Amazon roles, visible successful refresh timestamp and 4/4 healthy feeds. No horizontal overflow at 390px or 1440px.
- No environment changes required. Synergy Machines retains a known identity but no unverified category assignment. New code still requires deployment for scheduled production refreshes to retain expanded inventory.
