# Automatic employer discovery with Brave Search

Date: 2026-10-13
Status: proposed for written review

## Goal and agreed scope

FrontlaneJobs should discover employers beyond its manually registered list, verify their live job boards, and monitor their eligible jobs automatically. The user approved using Brave Search within its free monthly credit allowance, with an application limit of 30 search requests per day and 1,000 per calendar month.

The first version supports discovery of Greenhouse, Lever, and SmartRecruiters boards using the adapters already in the repository. It retains the current frontend-role, India-location, and explicitly worldwide-remote eligibility rules. It retains the 50-job selection target for each refresh. Ashby, custom careers-site crawling, an AI model, and a public employer administration interface are later work.

## Current behavior

`packages/core/src/sources.mjs` defines 43 fixed boards. The worker and daily production route fetch that list, select up to 50 jobs, and publish a complete selection snapshot for each successfully checked source. Failed sources preserve their previous listings. Research batches and private application trackers are separate.

There is no employer registry or discovery request ledger. The external daily scheduler currently has a 30-second default timeout. Discovery must have its own bounded execution path rather than increasing the daily refresh request's work without a limit.

## Chosen approach

Use Brave Web Search to find supported ATS board URLs. Store candidates in PostgreSQL, verify them against official live ATS responses, and promote qualifying boards into an employer registry. Both the production refresh and external refresh worker read that registry.

The public directory and Common Crawl approaches considered earlier are not required dependencies. They can become supplementary discovery adapters later. Search results supply leads; published job content comes from live employer feeds.

## Search budget and queries

The secret is `BRAVE_SEARCH_API_KEY`, supplied through environment configuration. Missing configuration skips search with a clear status and consumes no budget. Existing employer refresh continues to work.

Reserve one request in a durable database transaction before each Brave HTTP attempt. A successful reservation must fit both the daily and monthly caps. The reservation is committed separately from discovery work so a timeout, process crash, failed response, or later transaction rollback cannot restore spent allowance. Every retry requires another reservation; there are no uncounted HTTP retries. Concurrent runs cannot exceed either cap.

Use UTC day and calendar-month buckets consistently in storage and documentation. These are application caps; Brave's billing dashboard is authoritative for credit renewal. Other tools using the same account are outside this application's ledger. Operators should use a dedicated key and review provider-side limits. Thirty requests per day produces at most 930 requests in a 31-day application month.

Rotate a deterministic query catalog across supported ATS domains, frontend/React/Angular/Vue/UI/web-engineering terms, India cities, and explicitly worldwide remote searches. Persist query progress so repeated invocations advance instead of always issuing the first queries. Mix broad queries with recent-result queries; search indexing dates are not employer posting dates. Request at most 20 results per search. Pagination is another billable request and uses the same caps.

## Employer registry and candidate verification

Use a stable identity of provider plus normalized board identifier. Store the provider's original identifier separately when casing matters. Record the observed ATS URL, discovery query, first discovery time, verification status, employer display name, last attempt, next attempt, and bounded error information. Store search evidence without relying on snippets as verified job facts.

Seed the existing fixed boards idempotently as trusted registered sources. Discovery cannot rename or disable those existing records. Duplicate URLs and repeated discoveries of the same board merge into one candidate. Records with successful verification but no matching jobs remain eligible for later rechecking rather than permanently disappearing.

Only parse exact supported HTTPS ATS hosts and documented board URL shapes. Reject credentials, unrelated domains, reserved paths such as `robots.txt`, malformed identifiers, and deceptive hostname suffixes. Construct verification API URLs from validated provider identifiers; do not fetch arbitrary URLs returned by search. Treat redirects and employer metadata as untrusted inputs.

Verify a live feed with the existing normalization and eligibility logic. Derive the display name from provider metadata or an unambiguous official hosted-board identity, never by inventing a company name from a slug or trusting the search title alone. If reliable identity cannot be established, keep the candidate pending with a reason. Only a board with reliable identity and at least one valid eligible job is automatically registered for regular refresh. Preserve the evidence and timestamps needed to inspect that decision.

Rate limits, malformed feeds, missing identity, and network failures do not publish jobs or mark a company permanently invalid. Retry transient failures with backoff. Retain pending work across invocations. A successful discovery registers the source; the next regular refresh publishes its selected jobs using the existing ingestion contract.

## Bounded execution and refresh integration

Add an authenticated discovery cron route using `CRON_SECRET`, with a 20-second work deadline. Each invocation attempts at most two Brave searches and a small bounded verification batch. Check remaining time before beginning new work, propagate cancellation through requests, and leave unfinished candidates queued. Use durable leases to prevent concurrent verification of the same candidate; budget reservations remain independently atomic.

Add `pnpm jobs:discover` as a command that invokes the authenticated production discovery endpoint and prints its result. It requires `APP_URL` and `CRON_SECRET`; the Brave key stays on the server. Document an hourly external discovery schedule. Repeated hourly calls gradually reach the daily search cap and continue verification when search allowance is exhausted. Completion of all 30 searches is a maximum, not a guarantee when requests fail or time runs out.

The regular refresh merges trusted existing sources with verified registry sources. Poll existing boards plus a bounded batch of up to 20 discovered boards per refresh, prioritizing the least recently checked discovered boards. Unpolled sources retain their jobs until their next check. Rotate employer ordering for the daily selection so fixed list order cannot indefinitely exclude new sources once more than 50 employers have matching jobs.

The 50-job target applies to a refresh's successful selection, as it does today. Failed sources, research jobs, and discovered sources waiting for their next check can leave the public board with more than 50 active records. Publish complete snapshots only for feeds fully fetched and validated. A deadline that interrupts a source must preserve that source's prior jobs. Report unpolled and incomplete work explicitly rather than labeling it a successful check.

The external refresh worker obtains the registry's eligible source list through an authenticated server endpoint, keeping database access server-side. Update both refresh entry points so they share provider parsing, registry selection, and source identity. An empty initialized registry still includes the trusted original boards; database/configuration failures surface explicitly.

## Operations and observability

Persist discovery run results: reserved searches, successful searches, deduplicated candidates, verified and newly registered employers, no-match results, deferred verification, errors, and remaining daily/monthly allowance. Return a compact summary from the protected route and command. Never expose the API key or authentication tokens in logs or response bodies.

Extend the existing updates view with aggregate discovery status, last run time, and new-employer counts. Do not expose raw search queries or pending candidate details publicly. Document environment setup, migration, manual invocation, scheduler configuration, quota exhaustion, missing-key behavior, and partial failures. No production migration, deployment, scheduler change, or paid account signup is part of local implementation verification.

## Validation and acceptance

Use `node:test` and PGlite for atomic quota reservations under concurrency, day/month rollover, retries, and durable reservations after failed work. Test URL parsing and hostile/malformed inputs, source identity, candidate deduplication, name verification, eligibility, failed-feed preservation, resumed query progress, candidate leases, and deadlines.

Exercise the protected route and worker with mocked search/ATS responses. Verify that a newly discovered employer is registered and subsequently participates in a refresh, that seeded and research sources retain their isolation, and that employer ordering permits newly registered sources to be selected. Run the repository's typecheck, full test suite, and production build. Manually inspect the updates view at mobile and desktop widths and in both themes.

Local acceptance requires demonstrated discovery-to-refresh behavior and quota enforcement with fixtures. Live Brave discovery additionally requires an operator-configured key. Production acceptance requires deployment, migration, scheduler setup, a real discovery receipt, and a subsequent public job refresh receipt; local checks alone do not establish those results.

## References checked

- Brave pricing: https://brave.com/search/api/ — currently $5 per 1,000 search requests with $5 in monthly credits.
- Brave Web Search documentation: https://api-dashboard.search.brave.com/app/documentation/web-search — query operators, freshness, result limits, and pagination.
- Greenhouse Job Board API: https://docs.greenhouse.io/job-board.html
- Lever Postings API: https://github.com/lever/postings-api
