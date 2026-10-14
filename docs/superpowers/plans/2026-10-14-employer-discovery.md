# Automatic Employer Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Discover supported employers with Brave Search, verify their live jobs, and register them for future refreshes within durable request caps.

**Architecture:** Shared core modules own provider parsing, quota reservations, registry persistence, and bounded discovery orchestration. PostgreSQL stores candidates, leases, search attempts, query progress, and run receipts. Protected Next.js routes expose discovery and registry selection to the scheduler and external worker, and the existing updates page shows aggregate results.

**Tech Stack:** Node.js 22.13+, pinned pnpm, JavaScript ESM core modules, TypeScript Next.js 16 App Router, PostgreSQL, Zod, node:test, PGlite.

**Spec:** `docs/superpowers/specs/2026-10-13-employer-discovery-design.md`

## Global Constraints

- Search requests: 30 per UTC day and 1,000 per UTC calendar month, including retries and pagination.
- Discovery invocations: 20-second work deadline, at most two Brave search attempts, at most four candidate verifications.
- Search results: at most 20 per request; no AI model or additional search provider.
- Supported discovery adapters: Greenhouse, Lever, SmartRecruiters; keep existing eligibility rules.
- Refresh: retain the 50-job selection target; include existing boards and at most 20 discovered boards per invocation.
- Keep API keys and authentication tokens server-side; do not fetch arbitrary search-result URLs.
- Preserve transactional ingestion, replay handling, failed-source jobs, research-source isolation, and private user data.
- Core depends on database; database does not import core or application modules.
- Root `pnpm-lock.yaml` is the only lockfile. No new runtime dependencies are necessary.
- No production migration, deployment, account signup, or scheduler change during local implementation verification.

## Review Focus

- Crash after quota reservation: the reservation remains consumed even if no result or run receipt is saved; Task 2.
- Misleading hostname, redirect, or search title: no arbitrary-host request or guessed company registration; Task 3.
- Old search result pointing to a closed job: current live feed controls eligibility and search indexing dates never become posting dates; Task 4.
- Deadline during feed pagination: no partial snapshot closes previously selected jobs; Tasks 3 and 5.
- More than 50 eligible employers: newly discovered employers eventually participate and repeated workers do not silently use the old fixed list; Task 5.

---

## File Map

| File | Responsibility |
| --- | --- |
| `packages/database/schema/002-employer-discovery.sql` | Registry, request ledger, state, candidates, and run tables |
| `packages/database/scripts/migrate.mjs` | Apply all sorted schema files transactionally |
| `packages/core/src/discovery-budget.mjs` | Durable quota reservations and query progression |
| `packages/core/src/employers.mjs` | Seeded registry, candidates, leases, refresh selection, and public summary |
| `packages/core/src/board-discovery.mjs` | Supported URL parsing and official employer identity verification |
| `packages/core/src/discovery.mjs` | Brave adapter, query catalog, orchestration, and run receipts |
| `packages/core/src/sources.mjs` | Reusable feed fetching, deadline support, and ordering rotation |
| `packages/core/src/smartrecruiters.mjs` | Propagate caller cancellation and preserve company metadata |
| `apps/web/app/api/cron/discovery/route.ts` | Protected bounded discovery execution |
| `apps/web/app/api/ingest/sources/route.ts` | Protected registry selection and check acknowledgement |
| `apps/web/app/api/cron/jobs/route.ts` | Registry-backed regular refresh |
| `apps/worker/scripts/discover-employers.mjs` | Invoke discovery and print receipt |
| `apps/worker/scripts/refresh-jobs.mjs` | Fetch registry sources and acknowledge completed checks |
| `apps/web/app/updates/page.tsx` | Aggregate discovery status alongside source checks |
| `tests/discovery-budget.test.mjs` | Quota durability and concurrency |
| `tests/employers.test.mjs` | Registry selection, identity preservation, and leases |
| `tests/board-discovery.test.mjs` | URL and verification behavior |
| `tests/discovery.test.mjs` | Search orchestration and end-to-end discovery-to-refresh |
| `tests/helpers/discovery-db.mjs` | PGlite pool wrapper and complete schema fixture |
| `tests/routes.test.mjs`, `tests/worker.test.mjs`, `tests/sources.test.mjs` | Existing entry-point and ingestion regression coverage |
| `.env.example`, `README.md`, `docs/EMPLOYER-DISCOVERY.md` | Configuration, commands, and operations |

### Task 1: Persistent registry and schema migration

**Files:** Create the second SQL schema file, `employers.mjs`, `discovery-db.mjs`, and `employers.test.mjs`; modify the migration script and core package exports.

**Interfaces:**
- `seedEmployers(queryable) -> Promise<void>` inserts trusted `SOURCES` without overwriting existing identity.
- `upsertCandidate(db, candidate) -> Promise<{inserted:boolean}>`, where candidate has `provider`, `slug`, `source`, `boardUrl`, and `query`.
- `claimCandidates(db, {now, limit, leaseMs}) -> Promise<Candidate[]>` returns due candidates with lease tokens checked together with candidate identity.
- `recordVerification(db, candidate, result, {now}) -> Promise<{registered:boolean}>` checks lease ownership before updating.
- `registeredSources(queryable, {now, discoveredLimit=20}) -> Promise<{sources, deferred}>` returns trusted source tuples and least-recently-attempted verified discoveries.
- `markEmployerChecks(queryable, outcomes, {now}) -> Promise<void>` records attempts, including failures, without changing trusted identity.
- `discoveryPublicSummary(queryable) -> Promise<{lastRun, registeredEmployers}>` contains no raw queries or candidate evidence.

- [x] Write failing registry tests with a complete PGlite fixture. The fixture reads both SQL files in filename order and implements pool client release cleanup. Give test pool clients exclusive transaction access so overlapping tests cannot interleave PGlite's single backend transaction.

```js
test('repeated seeding preserves verified identities', async () => {
  const fixture = await discoveryDatabase();
  try {
    await seedEmployers(fixture.db);
    await seedEmployers(fixture.db);
    const selection = await registeredSources(fixture.db, {now: new Date('2026-10-14T00:00:00Z')});
    assert.equal(new Set(selection.sources.map(([p, s]) => `${p}:${s.toLowerCase()}`)).size, SOURCES.length);
    assert.deepEqual(new Set(selection.sources.map(row => row[2])), new Set(SOURCES.map(row => row[2])));
  } finally { await fixture.close(); }
});
```

- [x] Run `node --test tests/employers.test.mjs`; confirm the missing module/schema fails.
- [x] Create tables: `employer_sources` keyed by source, with provider/original slug/name/origin/verification/check timestamps; `discovery_candidates` keyed by source, with evidence, status, retry timestamp, lease token/expiry; `discovery_requests` keyed by UUID with UTC timestamp and query index; singleton `discovery_state` with next query index; `discovery_runs` keyed by UUID with start/end/status/JSON summary. Add indexes for due candidates, request timestamps, and source check priority.
- [x] Change migration to read sorted `.sql` files from `packages/database/schema`, run all in a transaction, roll back on failure, and always release/end the pool. Keep existing schema exports working for existing tests.
- [x] Implement registry mutations with parameterized SQL, seed `ON CONFLICT DO NOTHING`, candidate deduplication, expiring leases, and ownership checks. Use `FOR UPDATE SKIP LOCKED` when claiming due candidates. Retry no-match candidates after seven days; transient failures after an exponentially increasing delay capped at one day; pending identity candidates after one day.

```sql
WITH due AS (
  SELECT source FROM discovery_candidates
  WHERE next_attempt_at <= $1 AND (lease_expires_at IS NULL OR lease_expires_at <= $1)
  ORDER BY next_attempt_at, discovered_at, source
  FOR UPDATE SKIP LOCKED LIMIT $2
)
UPDATE discovery_candidates AS candidate
SET lease_token=$3, lease_expires_at=$4
FROM due WHERE candidate.source=due.source
RETURNING candidate.*;
```

- [x] Add tests for duplicate candidate URLs, trusted source preservation, lease expiry and stale completion rejection, no-match rescheduling, discovered-source priority, and failure attempts moving to the end of the refresh queue.
- [x] Run `node --test tests/employers.test.mjs tests/monorepo.test.mjs`; commit the schema/registry change.

### Task 2: Durable Brave request budget

**Files:** Create `discovery-budget.mjs` and `discovery-budget.test.mjs`; extend core exports.

**Interfaces:**
- `reserveSearch(db, {now=new Date()}) -> Promise<{allowed, attemptId?, queryIndex?, dayUsed, monthUsed, reason?}>`.
- `searchAllowance(queryable, {now=new Date()}) -> Promise<{dayUsed, monthUsed, dayRemaining, monthRemaining}>`.

- [x] Write failing tests for the 30th/31st request, the independent monthly guard using a prepopulated historical ledger of 999/1,000 entries, UTC midnight/month rollover, 40 concurrent attempts, and a simulated failure after reservation. Under normal daily accounting a 31-day month permits at most 930 requests; historical fixture entries deliberately exercise the additional monthly defense without attempting 1,000 ordinary reservations in one month.

```js
test('concurrent reservations never exceed the daily cap', async () => {
  const fixture = await discoveryDatabase();
  try {
    const now = new Date('2026-10-14T12:00:00Z');
    const attempts = await Promise.all(Array.from({length: 40}, () => reserveSearch(fixture.db, {now})));
    assert.equal(attempts.filter(row => row.allowed).length, 30);
    assert.equal((await searchAllowance(fixture.db, {now})).dayRemaining, 0);
  } finally { await fixture.close(); }
});
```

- [x] Run `node --test tests/discovery-budget.test.mjs`; confirm it fails before implementation.
- [x] Implement one short owned transaction: acquire a database advisory transaction lock for `frontlane-discovery-budget`, count ledger entries in half-open UTC day/month ranges, reject exhausted limits, allocate and advance query progress, insert a request reservation, commit, and release. Do not accept the refresh route's long-lived client as a substitute for an independently committed reservation.

```js
const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
// BEGIN; advisory lock; count ledger ranges; allocate query index; insert; COMMIT.
// Always ROLLBACK unfinished work and release the owned client in finally.
```

- [x] Verify that reserved requests remain counted when orchestration throws or its separate transaction rolls back. Test release on reservation errors and no query advancement when denied.
- [x] Run `node --test tests/discovery-budget.test.mjs tests/employers.test.mjs`; commit the durable budget change.

### Task 3: Safe board parsing and employer verification

**Files:** Create `board-discovery.mjs` and `board-discovery.test.mjs`; modify `sources.mjs`, `smartrecruiters.mjs`, and core exports.

**Interfaces:**
- `parseBoardUrl(value) -> null | {provider, slug, source, boardUrl}`.
- `fetchEmployerFeed([provider, slug, company], checked, {signal, fetchImpl=fetch}={}) -> Promise<{source, jobs?, status?, error?}>`; export the current feed logic under this name.
- `verifyCandidate(candidate, {signal, fetchImpl=fetch, now=new Date()}) -> Promise<{status:'verified'|'no-match'|'pending'|'failed', company?, matched?, error?}>`.
- `smartRecruitersJobs(slug, fetchJson, eligible, target, {signal}={})` combines caller cancellation with its existing bounded timeout.

- [x] Write failing parser tests for known job and board URLs, Greenhouse embedded `for` board URLs, SmartRecruiters case preservation, URL credentials, encoded path separators, nested deceptive hostnames, reserved paths, unsupported Ashby URLs, and invalid identifiers.

```js
test('search URLs cannot redirect verification to an arbitrary host', () => {
  assert.equal(parseBoardUrl('https://jobs.lever.co.attacker.example/acme'), null);
  assert.equal(parseBoardUrl('https://user:secret@jobs.lever.co/acme'), null);
  assert.equal(parseBoardUrl('https://jobs.lever.co/robots.txt'), null);
  assert.equal(parseBoardUrl('https://jobs.lever.co/a%2fb'), null);
});
```

- [x] Run `node --test tests/board-discovery.test.mjs`; confirm missing exports fail.
- [x] Implement exact HTTPS host matching for `boards.greenhouse.io`, `job-boards.greenhouse.io`, `jobs.lever.co`, and `jobs.smartrecruiters.com`. Decode only the relevant board segment, then validate against bounded provider identifier patterns. Normalize source identity to lowercase and retain the original slug for requests. Reject unexpected URL shapes instead of extracting any first segment.
- [x] Fetch identity only through constructed supported endpoints with redirects rejected: Greenhouse board metadata `name`; SmartRecruiters live listing/detail company metadata; Lever official board HTML with a bounded response body and a recognized employer title pattern. Empty, ambiguous, or overly long metadata stays pending. Do not use search titles or prettified slugs as company names.
- [x] Refactor feed fetching to accept an injected fetch function and combined deadline signal. Preserve existing behavior without options. Preserve SmartRecruiters company metadata for verification without changing published `JobInput` fields. Enforce verification feed application URLs belonging to the candidate board when hosted on an ATS; custom employer application links require a corroborated identity and stay pending if attribution cannot be established.
- [x] Add tests for valid identity plus eligible job, missing identity, title-only attribution rejection, metadata with invalid types, empty feeds, geographic restrictions, failed APIs, redirect rejection, and aborted SmartRecruiters pagination preserving old source jobs.
- [x] Run `node --test tests/board-discovery.test.mjs tests/sources.test.mjs tests/ingestion.test.mjs`; commit safe board verification.

### Task 4: Bounded Brave discovery orchestration

**Files:** Create `discovery.mjs` and `discovery.test.mjs`; extend core exports.

**Interfaces:**
- `discoveryQuery(index) -> {q, freshness?}` selects a deterministic provider/role/location query.
- `runDiscovery(db, {apiKey, fetchImpl=fetch, now=()=>new Date(), timeoutMs=20000}={}) -> Promise<DiscoverySummary>`.
- Summary fields: `runId`, `status`, `searchesReserved`, `searchesSucceeded`, `candidatesAdded`, `verified`, `registered`, `noMatch`, `pending`, `failed`, `deferred`, and `allowance`.

- [x] Write an end-to-end failing test that returns a search result for a previously unknown board, supplies trusted identity plus an eligible live job, runs discovery, loads the registry, runs refresh through ingestion, and asserts the new employer's job is active.

```js
const fixedClock = () => new Date();
const verifiedEmployerFixture = async (input) => {
  const url = new URL(input);
  if (url.hostname === 'api.search.brave.com') {
    return new Response(JSON.stringify({web: {results: [{url: 'https://job-boards.greenhouse.io/newco/jobs/1'}]}}));
  }
  if (url.hostname === 'boards-api.greenhouse.io' && url.pathname === '/v1/boards/newco') {
    return new Response(JSON.stringify({name: 'New Company'}));
  }
  if (url.hostname === 'boards-api.greenhouse.io' && url.pathname === '/v1/boards/newco/jobs') {
    return new Response(JSON.stringify({jobs: [{id: 1, title: 'Frontend Engineer', location: {name: 'Bengaluru, India'}, content: 'Build React interfaces.', absolute_url: 'https://job-boards.greenhouse.io/newco/jobs/1'}]}));
  }
  if (url.hostname === 'boards-api.greenhouse.io') return new Response(JSON.stringify({jobs: []}));
  if (url.hostname === 'api.lever.co') return new Response('[]');
  if (url.hostname === 'api.smartrecruiters.com') return new Response(JSON.stringify({content: [], totalFound: 0}));
  throw Error('Unexpected fixture request host');
};
const summary = await runDiscovery(db, {apiKey: 'fixture-key', fetchImpl: verifiedEmployerFixture, now: fixedClock});
assert.equal(summary.registered, 1);
const {sources} = await registeredSources(db, {now: fixedClock()});
await refreshSources(batch => ingest(batch, db), {sources, fetchImpl: verifiedEmployerFixture});
assert.equal((await db.query("SELECT count(*)::int AS count FROM jobs WHERE active AND source='greenhouse:newco'")).rows[0].count, 1);
```

- [x] Run `node --test tests/discovery.test.mjs`; confirm discovery does not exist yet.
- [x] Define the query catalog in code from supported ATS hosts, six role phrases, and India/worldwide-remote variants. Use persisted reservation query indices to cycle through catalog entries and broad/recent searches. The first version uses one result page per query; no implicit pagination or HTTP retries.
- [x] Send each Brave request to `https://api.search.brave.com/res/v1/web/search` with `q`, `count=20`, `country=IN`, `search_lang=en`, and optional freshness. Set `X-Subscription-Token` from the server-only key. Reserve before every HTTP attempt and enforce the two-attempt invocation limit. Validate `web.results` as a bounded array of URL-bearing objects; ignore malformed individual URLs, but record malformed top-level responses as failures. Never log the header or full error responses.
- [x] Claim an expiring run lease before work. Use a monotonic deadline for elapsed work and UTC timestamps for storage. Give HTTP calls at most six seconds and combine that timeout with the invocation signal. Process a verification batch before search so a search backlog cannot starve pending candidates; use remaining time for at most two searches and optional newly added candidate verification, with four verifications total. Stop starting work when insufficient time remains.
- [x] Save candidate progress and a bounded run summary independently. Missing keys produce a clear skipped-search summary with zero reservations; pending verification can still advance. Exhausted budgets stop searching but allow queued verification. Failed persistence must surface as an error, not as a successful discovery receipt. Complete only leases owned by the current run token.
- [x] Test quota exhaustion, missing key, 429/503/timeouts consuming reservations, malformed results, duplicate boards, query rotation after partial work, stale result with no live eligible job, no invented posting dates, deadline deferral, crashed/expired leases, and secrets excluded from summaries.
- [x] Run `node --test tests/discovery.test.mjs tests/discovery-budget.test.mjs tests/board-discovery.test.mjs`; commit discovery orchestration.

### Task 5: Registry-backed regular refresh

**Files:** Modify `sources.mjs`, `apps/web/app/api/cron/jobs/route.ts`, `apps/worker/scripts/refresh-jobs.mjs`, `tests/sources.test.mjs`, and `tests/helpers/refresh-fetch.mjs`; create `apps/web/app/api/ingest/sources/route.ts`.

**Interfaces:**
- `refreshSources(publish, {sources=SOURCES, signal, fetchImpl=fetch, rotation=0}={})` keeps its outcome array return value.
- Protected `GET /api/ingest/sources` returns `{sources, deferred, rotation}` to `INGEST_TOKEN` callers.
- Protected `POST /api/ingest/sources` accepts `{checkedSources:string[]}` with at most 100 supported source IDs and records attempted checks for registered sources only.

- [x] Add failing tests proving the server and worker both include a discovered employer, discovery selection is capped at 20, sources waiting their turn retain jobs, and rotating selection includes an employer beyond position 50.

```js
test('rotating employer order includes sources beyond the first fifty', async t => {
  const sources = Array.from({length: 60}, (_, i) => ['greenhouse', `company${i}`, `Company ${i}`]);
  const selected = [];
  t.mock.method(globalThis, 'fetch', async input => {
    const slug = new URL(input).pathname.split('/').at(-2);
    return new Response(JSON.stringify({jobs: [{id: 1, title: 'Frontend Engineer', location: {name: 'India'}, content: 'Build React interfaces.', absolute_url: `https://job-boards.greenhouse.io/${slug}/jobs/1`}]}));
  });
  await refreshSources(async batch => {selected.push(...batch.jobs);}, {sources, rotation: 50});
  assert.ok(selected.some(job => job.company === 'Company 59'));
  assert.equal(selected.length, 50);
});
```

- [x] Run `node --test tests/sources.test.mjs tests/worker.test.mjs tests/routes.test.mjs`; confirm new registry integration assertions fail.
- [x] Read the installed Next.js route-handler and route-segment configuration documentation before changing routes. Seed trusted sources and load the registry using the existing refresh lock client. Rotate the source array using a UTC date-derived offset before the existing round-robin job selection. Use existing sources plus up to 20 discovered sources ordered by least recent attempt. Update attempted check timestamps for completed and failed sources; do not mark deferred sources checked.
- [x] Add source-list GET/acknowledgement POST routes with authentication before database access and strict request validation. Return no pending candidate evidence. Acknowledge worker failures too, so unhealthy boards cannot permanently occupy the first 20 discovery slots.
- [x] Make the worker fetch the protected registry endpoint before employer APIs, validate returned source tuples, pass them to `refreshSources`, publish through the existing ingestion endpoint, persist failure statuses, and acknowledge attempted registered sources. If source-list retrieval fails, exit unsuccessfully instead of silently using only the fixed list.
- [x] Update worker preload fixtures to distinguish registry GET, acknowledgement POST, status POST, and ingestion POST. Add interrupted-feed regression coverage: a partial successful page followed by abort/failure must not replace that source's snapshot. Keep research-source and tracker tests intact.
- [x] Run `node --test tests/sources.test.mjs tests/worker.test.mjs tests/routes.test.mjs tests/ingestion.test.mjs`; commit registry-backed refresh.

### Task 6: Protected discovery route and worker command

**Files:** Create `apps/web/app/api/cron/discovery/route.ts` and `apps/worker/scripts/discover-employers.mjs`; modify root/worker manifests and route/worker tests; create `tests/helpers/discovery-fetch.mjs`.

**Interfaces:**
- `GET /api/cron/discovery` uses `CRON_SECRET` and returns the saved summary with `Cache-Control: no-store`.
- `pnpm jobs:discover` invokes that endpoint with `APP_URL` and `CRON_SECRET` and prints its receipt.

- [x] Write failing authorization tests that assert no database/search access for missing or invalid tokens, missing-key zero quota usage, bounded success, lease contention, and database failure. Add subprocess worker tests for missing configuration, correct authorization, timeout, malformed receipts, and non-success HTTP statuses.

```js
const response = await discoveryRoute.GET(new Request('https://frontlane.example/api/cron/discovery'));
assert.equal(response.status, 401);
assert.equal(searchRequests, 0);
assert.equal(databaseQueries, 0);
```

- [x] Run `node --test tests/routes.test.mjs tests/worker.test.mjs`; confirm new entry points fail.
- [x] Implement the route with `runtime='nodejs'`, `maxDuration=30`, authentication first, and a 20-second core deadline. Return 202 for an occupied run lease, 200 for a persisted result including skipped/exhausted/partial statuses, and 503 for unavailable persistence. Public error bodies use a fixed generic message.
- [x] Implement the command with configuration validation, a 30-second request timeout, a fixed endpoint path, server-secret authorization, receipt validation, and nonzero exit status for HTTP/configuration errors. Add root and worker scripts using the existing environment-loading pattern. Do not supply the Brave key to the command.
- [x] Run `node --test tests/routes.test.mjs tests/worker.test.mjs tests/monorepo.test.mjs`; commit discovery entry points.

### Task 7: Public discovery summary and operating instructions

**Files:** Modify `apps/web/app/updates/page.tsx`, `.env.example`, and `README.md`; create `docs/EMPLOYER-DISCOVERY.md`.

**Interfaces:** The page consumes `discoveryPublicSummary` and existing `source_checks`; no new public API is needed.

- [x] Add a focused aggregate-query test proving no pending candidate queries, URLs, or secret values appear in `discoveryPublicSummary` and that no discovery runs yields an empty state.
- [x] Run `node --test tests/employers.test.mjs`; confirm the summary expectation fails if it is not yet implemented.
- [x] Add a small discovery section using existing page classes: last run in IST, newly registered employers from that run, total discovered registered employers, and a plain status for skipped/pending/failed work. Preserve existing source-check display. Distinguish selection target from total active jobs and describe how new employers join monitoring.

```tsx
<h2>Company discovery</h2>
<p>{summary.lastRun
  ? `${summary.lastRun.registered} employers added in the latest discovery run.`
  : 'No company discovery runs have completed yet.'}</p>
```

- [x] Add `BRAVE_SEARCH_API_KEY=` to `.env.example`. Document UTC caps, separately committed failed-attempt reservations, provider billing limits, a dedicated key, supported providers, pending identity results, missing-key operation, migration, `pnpm jobs:discover`, and an hourly scheduler calling the protected discovery route with response-body storage off. Keep the existing daily jobs scheduler separate and enabled once.
- [x] Explain the at-most-20 discovered employer refresh window, how failed attempts rotate, why the total active board can exceed 50, and that unsupported/custom careers pages remain outside automatic discovery. Include precise production activation steps without claiming they ran.
- [x] Run `pnpm typecheck`, `pnpm test`, and `pnpm build`. Inspect `/updates` with no discovery runs and a populated fixture at mobile/desktop sizes and both themes. Prefer available browser tooling; do not expose credentials to the browser. Commit UI and operational documentation.

### Task 8: Final verification and review handoff

**Files:** Update this plan's checkboxes and the operational document only if verification uncovers a real change.

- [x] Reconcile every acceptance condition with an executed test or manual check: request caps; durable failed-attempt accounting; safe identity verification; resumable work; discovered employer registration; both refresh paths; partial-feed preservation; fairness; aggregate public status.
- [x] Run the required full checks once after final code changes: `pnpm typecheck`, `pnpm test`, `pnpm build`. Do not repeat passing checks without an intervening change or unresolved concern.
- [x] Inspect `git diff --check`, package exports, lockfile changes, and the full branch diff. Confirm no real secrets or generated credential files were added. Review against the five Review Focus cases.
- [x] Use the required code-review workflow at execution time. Native execution uses one fresh whole-branch reviewer after implementation; subagent execution uses its prescribed per-task reviewers and final review. Address findings with regression tests for demonstrated defects.
- [x] Report implementation files, test results, and the exact remaining activation requirements: configure the Brave key, apply production schema, deploy, configure the discovery schedule, run live discovery, and verify the subsequent published jobs. Do not label production discovery operational without those receipts.

## Self-review result

The eight tasks cover all approved spec sections. Function signatures and summary names are consistent between registry, engine, routes, workers, and UI. The five Review Focus cases are assigned explicit tests. Search-cost accounting remains outside any transaction that spans network calls. Native execution is recommended because the tasks share closely coupled database and adapter interfaces and can be implemented sequentially in this session with a fresh final review.
