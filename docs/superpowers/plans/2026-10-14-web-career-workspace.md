# Web Career Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Implement inline; no delegation is requested.

**Goal:** Deliver the approved web discovery, application workspace, recommendations, and opt-in daily inbox roadmap.

**Architecture:** Extend shared core models additively and store private workflow data in PostgreSQL. Keep public search cacheable, private matching/workspaces uncached, and daily digest delivery outside ingestion transactions through a durable outbox. Build and verify eight sequential increments.

**Tech Stack:** Node.js 22.13+, pinned pnpm, Next.js App Router, React, TypeScript, existing Tailwind/Radix primitives, PostgreSQL, node:test, PGlite, Resend HTTPS API.

**Spec:** `docs/superpowers/specs/2026-10-14-web-career-workspace-design.md`, including the user-approved daily email addition and both digest modes (matching by default).

## Global Constraints

- Web only; do not edit apps/mobile. Optional shared additions must preserve existing mobile requests and responses.
- Use Node.js 22.13+, pinned pnpm, strict TypeScript, existing UI primitives, and pnpm-lock.yaml as the only lockfile.
- Keep browsing public and member information private. Reuse authenticated identity, same-origin write checks, bounded request bodies, and no-store private responses.
- Unknown salary, experience, benefits, working hours, or company facts remain unknown. Do not display hiring-probability percentages.
- No automatic application submission or outbound recruiter messages. Tests and local previews send no live email.
- Changes are local until deployment is explicitly requested. Do not migrate production, register external services, or alter production schedules.
- Before coding, read installed Next.js docs for route handlers, searchParams, caching, and navigation. Read scoped repository instructions for every modified directory.
- Use a feature workspace if available; determine existing isolation first. The current checkout is main, so resolve workspace preference before executing. Do not create commits or manipulate git metadata where filesystem permissions do not permit it.

## Review Focus

1. A feed larger than 100 eligible jobs must not close jobs between chunks or issue false publication events: Task 2 integration tests.
2. A legacy mobile tracker/profile POST must not erase new web metadata: Tasks 4 and 5 compatibility tests.
3. A private match, contact, offer, or email recipient must never reach a public cache or anonymous response: Tasks 4–8 route tests.
4. A job rechecked, reselected, or republished by another source must not create another new-job email: Tasks 2 and 7 publication tests.
5. A provider-accepted email with a lost HTTP response must not be resent after idempotency expires: Task 7 crash/retry tests.

## Execution and verification conventions

- For each behavioral test below: write the test, run it and inspect the expected missing-behavior failure, implement that behavior, then rerun. Import/setup errors must be corrected before treating a test as RED evidence.
- Run targeted tests after each behavior and the full `pnpm test` at each completed increment. Track progress and decisions in `docs/superpowers/plans/web-career-workspace-progress.md` so interrupted work resumes without repetition.
- Use the approved design as authority for details. Each task has a independently usable deliverable. Do not stop for approval between increments once this plan is reviewed.

## Task 1: Add truthful job enrichment and shared compatibility

**Files:** Create `packages/core/src/job-enrichment.mjs`; modify core ingestion/tracker/source validators, adapters, package exports, and `packages/contracts/index.ts`; add `tests/job-enrichment.test.mjs`.

**Interfaces:** Export `JobEnrichmentInput`, `enrichJob({title,description,metadata})`, and `technologyTokens(text)`. Add optional `Job.enrichment` containing description, compensation, seniority, years, required/preferred skills, benefits, source evidence, and known arrangement. Existing required Job fields stay unchanged.

- [ ] Add failing tests for explicit compensation units, unknown/conflicting salary, experience extraction, description bounds, explicit versus unknown arrangement, HTML cleanup, and token boundaries. Example behavioral assertion:

```js
test('React Native alone does not advertise React web', () => {
  assert.deepEqual(technologyTokens('Build React Native apps with TypeScript'), ['React Native','TypeScript']);
});
```

- [ ] Run `node --test tests/job-enrichment.test.mjs`; expected: new assertions fail because existing extraction uses substring matching and generic facts.
- [ ] Implement shared Zod enrichment fields with bounded arrays/strings. Monetary values use nonnegative finite numbers, known currency codes, explicit period, and `min <= max`; ambiguous prose does not produce normalized compensation. Retain the current summary and full cleaned description separately.
- [ ] Integrate enrichment into Greenhouse/Lever/SmartRecruiters normalization and tracker snapshots. Keep manual publication/seed payloads without enrichment valid. Expand trusted ingestion size bounds deliberately for full descriptions: maximum 100 jobs, each description at most 40,000 characters, total request at most 5 MB; enforce the stream bound before JSON parsing.
- [ ] Test real adapter fixtures and all legacy seed jobs through both validators. Run `node --test tests/job-enrichment.test.mjs tests/sources.test.mjs tests/ingestion.test.mjs tests/routes.test.mjs` and then `pnpm test`; expected: all pass.

## Task 2: Separate source availability, daily selection, and first publication

**Files:** Add `packages/database/schema/005-job-workspace.sql`; modify core ingestion/sources/SmartRecruiters/public-jobs/jobs and cron/worker callers; add `tests/job-publication.test.mjs` and a full-schema PGlite helper.

**Interfaces:** Add nullable source availability, `board_selected`, stable company/source identity, and a canonical first-publication event table. Extend trusted snapshot publication with `selectedUrls` and explicit final reconciliation. Preserve legacy `Batch` callers. Export `publicationEvents(db,{after,through})` returning durable ordered events with job snapshot and canonical URL.

- [ ] Write PGlite tests for 125 eligible jobs with only 50 selected, a job leaving selection while remaining in source, true closure after a complete source, malformed second chunk rollback, source failure preservation, community publication, replay, and cross-source duplicate URL.
- [ ] Run `node --test tests/job-publication.test.mjs`; expected: present selection-snapshot semantics fail the available-but-unselected case.
- [ ] Migration backfills selected state from current active state but leaves source availability unknown for old inactive rows. Backfill first-publication records at migration time as baseline events excluded from historical alerts. Use a unique canonical URL for first publication:

```sql
CREATE TABLE IF NOT EXISTS job_first_publications (
  canonical_url text PRIMARY KEY,
  job_id text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  baseline boolean NOT NULL DEFAULT false
);
```

- [ ] Fetch complete eligible source snapshots; remove SmartRecruiters early termination at the daily target. Cap upstream page traversal and reject incomplete pagination as source failure. Chunk trusted writes with one source savepoint/transaction, and reconcile absence only after every chunk succeeds.
- [ ] Keep the 50-job selector; board queries require selection, while availability can remain true outside it. Preserve failed and deferred employers' existing rows. Canonical URL conflicts retain employer display priority. Publication insert uses `ON CONFLICT DO NOTHING` in the publishing transaction.
- [ ] Update first-discovery handling so refreshes retain original dates and selected public publication has its own timestamp. Include new-publication count in cron diagnostics without changing the existing summary fields.
- [ ] Run source/ingestion/worker/reliability/publication tests and `pnpm test`; expected: replay/source isolation and new availability cases pass.

## Task 3: Ship the improved public web discovery experience

**Files:** Refactor `apps/web/app/jobs/board.tsx` into board/search/card/detail components; modify jobs page/API and core search; add company page/API, company metadata core module, logo component, comparison page, and scoped CSS. Add `tests/job-search.test.mjs` and company route tests.

**Interfaces:** Export `normalizeJobSearch(params)`, `serializeJobSearch(search)`, and `matchesJobSearch(job,search)`. Keep single `stack` accepted; multiple stacks serialize as repeated `stack` parameters with ANY semantics. Add city, seniority, compensationKnown, salaryMin, currency, and payPeriod. Unknown filters are rejected/normalized consistently in live and curated paths.

- [ ] Write behavioral search tests for URL round trips, multi-stack ANY filtering, explicit arrangement, city, unknown salary, mismatched pay units, escaping SQL wildcards, and equivalent live/seed results. Test IDs outside page one and company identity without fuzzy merging.
- [ ] Run `node --test tests/job-search.test.mjs tests/routes.test.mjs`; expected: current filters/initial rendering do not satisfy the new cases.
- [ ] Implement normalized parameterized query construction and fallback parity. Parse all initial search parameters in the server page. Keep personal data out of `/api/jobs`. Public sort is relevant/newest/remote; preserve old recommended requests as an alias for relevant.
- [ ] Implement URL-synced filter controls, filter chips, page reset, fetch abort, labelled stale-result retry, and keyboard-friendly detail panel/sheet. Browser back/forward rehydrates query state; close detail removes only the job parameter.
- [ ] Add concise cards with up to four technologies, optional official logo and initials fallback, explicit arrangement/eligibility, salary units, source label, and Save/View/Compare actions. Keep save errors local to the job action and avoid disabling unrelated cards globally.
- [ ] Add company identity/metadata list/detail using curated source mappings and verified official media. Unknown companies receive only known name/source facts and their roles. Do not infer domain from name/ATS host. Record image attribution in `docs/COMPANY-MEDIA.md`.
- [ ] Public compare accepts two or three unique job IDs in repeated URL parameters. Compare known facts with explicit unavailable cells and money unit labels; no cross-unit numeric ranking.
- [ ] Run search/company/route tests, `pnpm test`, and web typecheck. Preview 360/768/1440px in both themes, long titles, empty states, loading, broken logos, URL sharing, and keyboard focus. Expected: no overflow and stable search context.

## Task 4: Add transactional private tracker workflows

**Files:** Add `packages/database/schema/006-private-workspace.sql`; extend core tracker into focused storage/activity/calendar modules; modify tracker route; add `tests/tracker-workspace.test.mjs` and private child-route tests.

**Interfaces:** Export `patchApplication(db,userId,{id,revision,changes})`, `listApplications(db,userId,{cursor,limit,archived})`, `applicationHistory(db,userId,id)`, `saveApplicationChild(db,userId,id,kind,input)`, and `interviewCalendar(interview)`. PATCH is version checked. Explicit `paginated=1` GET returns `{items,nextCursor}`; legacy GET still returns the array.

- [ ] Write tests for concurrent revision conflicts (409), missing owner, atomic stage/history changes, required submission confirmation, reschedule/complete-follow-up, archive, legacy POST preservation, contacts/documents/interviews/offers, and more than 1,000 application rows.
- [ ] Run `node --test tests/tracker-workspace.test.mjs tests/routes.test.mjs`; expected: new history/revision/metadata cases fail against existing full-payload replacement.
- [ ] Add `revision` and optional workspace metadata. Use a row lock for mutable payload merge; update only fields supplied by legacy clients and preserve extended data. PATCH validates changes, checks revision, inserts server activity, and commits atomically:

```sql
SELECT id,payload,revision FROM applications
WHERE id=$1 AND user_id=$2 FOR UPDATE;
```

- [ ] Use member-owned application foreign keys/ownership queries for children. Bound notes, URLs, contact fields, document labels, interview metadata, and offers; validate actual dates, UTC timestamps, and timezone identifiers. Limit children to 100 per kind/application. Do not store untrusted HTML.
- [ ] Cursor is opaque base64url `{updatedAt,id}` validated on read; order by updated_at DESC,id DESC. Clamp limit to 100. CSV export follows pages and includes escaped new fields.
- [ ] Calendar generation escapes commas, semicolons, backslashes, and newlines; emit CRLF, stable UID, UTC DTSTAMP/DTSTART/DTEND, and text/calendar content type. Prevent injected VEVENT records and fold long lines.
- [ ] Run tracker/private-route/session tests and `pnpm test`; expected: ownership, concurrency, transactional rollback, legacy preservation, and cursor completeness pass.

## Task 5: Ship Today, board, application details, and matching preferences

**Files:** Split web tracker into Today/list/board/details components; extend account preferences UI/core profile validation; add recommendations core module, private API and feedback table; add matching/date tests.

**Interfaces:** Export `matchJob(job,preferences)` returning `{eligible,reasons,unknowns,rank}` and `rankRecommendations(jobs,preferences,feedback)`. Add optional `Profile.matchingPreferences`; retain every legacy string field. Private `/api/recommendations` returns paginated jobs with per-user reasons and is always no-store. `/api/job-feedback` accepts hide-job/hide-company/reset.

- [ ] Write tests for timezone day boundaries, overdue/today/upcoming tasks, current interview state, old-profile POST preservation, React versus React Native, known versus unknown requirements, explicit restrictions, employer diversity only within equal tiers, and feedback isolation.
- [ ] Run targeted tests; expected: current tracker/profile lacks these workflows and matching behaviors.
- [ ] Implement Today with date-only follow-ups evaluated in selected timezone; upcoming interviews use timestamps. Keep follow-ups visible on narrow web layouts. Quick actions use PATCH and restore state on failure. Conflicts offer refresh without overwriting local notes.
- [ ] Implement table/board tabs, existing seven stages, accessible stage menus, priority, archive, history, contacts, interviews, document versions, offers, and persistent preparation checklist. Board does not require drag-and-drop. Fetch history/children on details open, not for every list row.
- [ ] Add short matching setup and editable account preferences with skill tokens, role targets, known numeric years, cities, arrangements, employment types, and salary currency/period. Legacy strings become visible suggestions only. Merge old profile updates rather than replace structured preferences.
- [ ] Rank by lexicographic skill overlap, role/seniority alignment, work/location alignment, recency, and employer diversity within equal tiers. Return supported reasons, unknown-data notices, and preference editing links; no hire percentage. Hidden feedback stays persistent and private.
- [ ] Add For you tab and conditional setup CTA to the board. Missing preferences prompt setup; errors provide retry, never a disguised personalized fallback.
- [ ] Run full tests and web/mobile shared-contract typecheck. Manually verify private tracker with local authenticated fixture, conflicts, keyboard dialogs, narrow layouts, both themes, and export.

## Task 6: Add saved searches and in-app notifications

**Files:** Add `packages/database/schema/007-alerts.sql`; add core saved-search/notification module and private routes; add web notifications/settings UI; add `tests/job-alerts.test.mjs`.

**Interfaces:** `saveSearch(db,userId,input)`, `listSavedSearches(db,userId)`, `evaluateNotifications(db,userId,{through})`, `readNotifications(db,userId,{cursor})`, and `markNotificationRead(db,userId,id)`. Saved searches reuse Task 3 normalized criteria. Each member has at most 20 searches.

- [ ] Write tests for no historical flood, first publication versus recheck, canonical URL duplicate suppression, hidden jobs, disabled/deleted searches, concurrent evaluation, transaction rollback/boundary preservation, and cross-user IDs.
- [ ] Run `node --test tests/job-alerts.test.mjs`; expected: missing saved-search/evaluation behavior.
- [ ] Initialize new search boundary to the latest committed publication event sequence. Evaluate newer events under member/search locking, persist `(user_id,search_id,canonical_url)` unique notifications, and advance the boundary only in the successful transaction. Do not scan raw discovered dates.
- [ ] Expose authenticated CRUD/read APIs with same-origin writes and no-store. Add board Save search, account management, unread count, notifications page, and mark-read controls. Visible-tab evaluation is debounced; don't poll hidden tabs.
- [ ] Store search names/criteria privately and bound notification/page size. Restored links serialize the frozen search context plus role ID.
- [ ] Run alerts/private routes and full tests; manually verify a new publication appears once, settings persist, and public visitors cannot access notifications.

## Task 7: Deliver opt-in daily new-jobs inbox digests

**Files:** Add `packages/database/schema/008-email-digests.sql`; add focused core digest/subscription/outbox/email-template modules and web email transport; add subscription/cron/unsubscribe/webhook routes, account and board opt-in UI, private digest page, and `docs/EMAIL-DIGESTS.md`. Extend `.env.example`. Add `tests/email-digests.test.mjs` and digest route tests.

**Interfaces:** `setDigestSubscription(db,{userId,verifiedEmail,enabled,mode})`, `queueDailyDigests(db,{publicationDay,through})`, `drainDigestOutbox(db,{transport,now,limit,signal})`, `unsubscribeDigest(db,token)`, and `renderDigest(delivery,{appUrl,from})`. Transport is `async ({body,idempotencyKey,signal}) => {providerId}`. Mode is matching/all, default matching.

- [ ] Write tests for all/matching modes, missing explicit preferences, verified email binding, disabled-by-default, no empty sends, old catalogue exclusion, one member/day, community jobs, daily refresh failure/skips, cross-source/reselection duplicates, concurrent claims, and frozen retry content.
- [ ] Write transport tests using an injected fetch returning provider fixtures. Verify endpoint, timeout, non-sensitive errors, identical retry body/key, Retry-After, permanent/temporary errors, and an ambiguous response beyond 24 hours. No real addresses or real email network calls.
- [ ] Run digest tests; expected: missing queue/subscription/transport behavior.
- [ ] Store subscriptions with mode, activation boundary, verified email, token hash, suppression, and generation. Store immutable digest snapshots and delivery outbox with unique user/day keys, claims/lease, attempts, next_attempt_at, first_attempt_at, provider_id, and terminal states.
- [ ] Queue after the successful refresh commits, with a durable daily campaign row and bounded recipient pagination so a timeout can resume campaign creation. Drain route resumes queue creation as well as sending. Failures in digest work add email diagnostics but do not turn successful ingestion into failure.
- [ ] Claims use short transactions and `FOR UPDATE SKIP LOCKED`; send outside transactions. Retry times are 1m, 5m, 15m, and 1h, then hourly within the 24-hour provider-key window. Honor longer Retry-After. Use a deterministic delivery UUID key and frozen JSON. Expired ambiguous attempts require reconciliation; unsent snapshots older than 48h expire.
- [ ] Resend transport posts to the official HTTPS `/emails` endpoint using a server-only API key, per-attempt 10-second timeout, content-type, and Idempotency-Key. Limit sends to one per second by default, respecting provider headers. A configuration-free injected test transport remains available only in tests.
- [ ] Render HTML-escaped responsive digest and plain text, at most 20 role cards, known facts only, private full digest link, subscription controls, and unsubscribe. Add opaque 32-byte token; store only its hash outside the private immutable delivery body. Scanner-safe GET displays confirmation; token-authorized POST disables subscription and cancels pending generations. RFC one-click POST requires no session.
- [ ] Verify raw webhook bytes with the official `svix` library (add to the importing workspace) and a timestamp window; store unique webhook receipt IDs. Only signed events associated with known provider IDs update delivery/suppression. Bounce/complaint suppresses future email; accepted is distinct from delivered.
- [ ] Add `RESEND_API_KEY`, `EMAIL_FROM`, `RESEND_WEBHOOK_SECRET` documentation and availability checks. Enable subscription only when settings are available; do not expose secrets or accept client-supplied recipient addresses. Derive the web email from verified Google session identity, preserving existing getUser response compatibility.
- [ ] Add `/api/cron/digests` authorization using existing CRON_SECRET, bounded drain of up to 20 deliveries per invocation and a 25-second deadline. Daily refresh uses only remaining execution budget; no provider calls inside refresh lock. Document the additional ten-minute retry schedule without configuring production.
- [ ] Run full tests, web typecheck, and render email HTML at 360px and desktop using fixtures. Verify unsubscribe GET is non-mutating, signed POST works, and no private digest is accessible by another account.

## Task 8: Complete preparation, offers, progress, and release verification

**Files:** Finish tracker preparation/offer comparison/progress components; add private metrics and public-safe aggregate event core/routes; update README/privacy/operations docs; add `tests/workspace-tools.test.mjs` and telemetry route tests.

**Interfaces:** `compareOffers(offers)` returns unit-aware values with no blended equity total; `preparationPrompts(job)` returns grounded/generic labeled prompts; `workspaceMetrics(db,userId,{from,to})` returns distinct confirmed application/history metrics; telemetry accepts only an event enum and a public job ID, never freeform notes or searches.

- [ ] Write tests for mixed money units, unknown offer values, owner-only access, descriptions without technology evidence, persisted checklist/answers, legacy history coverage, distinct application denominators, and rejected telemetry properties containing contacts/search text.
- [ ] Run targeted tests; expected: current workspace has no unit-aware comparison/preparation/history metrics.
- [ ] Add private offer comparison of at most three applications. Keep currency/period labels and explicitly show non-comparable values. Separate base, variable, equity text, and dates; do not compute cross-currency totals.
- [ ] Add persisted checklist and editable preparation answers. Ground prompts in known technology/responsibilities; distinguish generic frontend suggestions. Provide copyable follow-up/thank-you templates with editable blank contact fields, never automatic sending.
- [ ] Add progress time-range controls and historical-coverage notices; compute from server history and distinct confirmed application IDs. Empty denominators yield insufficient data. Record minimal aggregate events with a documented 90-day retention and disable switch; keep signed-in workflow history private.
- [ ] Update privacy and operational docs for new private records, publication semantics, media attribution, email opt-in/suppression, migration order, and configuration. Ensure unsubscribe/account controls and navigation work in both themes.
- [ ] Run `pnpm typecheck`, `pnpm test`, and `pnpm build`. Expected: all pass; any baseline or environment failures must be named in the progress record and final report.
- [ ] Review the complete diff for cache leaks, ownership gaps, unsafe description rendering, unknown facts, concurrency, email transaction boundaries, and unused code. Verify web at 360/768/1440px, themes, keyboard navigation, long titles, no-match, provider unavailable, conflict/retry, broken media, URL/back navigation, and all private flows using a local fixture.
- [ ] Deliver code, migrations, docs, verification results, and screenshots. Clearly state that production email activation requires the API key, verified sender/domain, signed webhook registration, migrations, and digest retry schedule; do not claim delivery or deployment occurred locally.

## Coverage and dependency check

- Task 1 enrichment feeds Tasks 2/3/5; Task 2 publication events feed Tasks 6/7. Task 3 search normalization is reused by saved searches and public comparison. Task 4 private persistence feeds Task 5 UI and Task 8 tools. Task 5 matching feeds Task 7 matching digests. These signatures are the shared interface authority.
- The design's full descriptions, logos/media/company context, discovery controls, availability, tracker workflows/history/children/pagination, preferences/recommendations/feedback, saved searches/alerts, both email modes, public/private comparisons, preparation, and measurements each have an owning task above.
- All five Review Focus cases have named test steps. Live production OAuth, provider delivery, domain DNS, and scheduler activation remain deployment checks, not local completion claims.
