# Remote frontend jobs

`/jobs/remote` reuses the jobs board with `collection=remote`. The Remote only switch preserves useful filters while clearing city, arrangement, page and selected role. The collection requires remote work and explicit worldwide or India eligibility. Generic “remote”, unclear roles, hybrid and contradictory residency restrictions are excluded. Timezone constraints remain visible.

## Free sources and attribution

- Remote OK: https://remoteok.com/api — free JSON feed. Credit Remote OK and link to each original listing without `nofollow`; do not use its logo. See https://remoteok.featurebase.app/help/articles/3140840-is-there-an-api-or-rssjson-feed-of-remote-jobs.
- We Work Remotely: https://weworkremotely.com/categories/remote-programming-jobs.rss — public RSS with attribution and links back. See https://weworkremotely.com/remote-job-rss-feed.
- HN Who is hiring: Algolia discovers the latest two monthly threads by `whoishiring` and paginates their comments. Only top-level comments with an explicit single frontend role and remote geography are accepted. Discussion replies and ambiguous multi-role headers are skipped. See https://hn.algolia.com/api and https://github.com/HackerNews/API.

Remotive is excluded from this version because its public API adds redistribution and signup-gate restrictions. No paid services, API keys or model calls are used by these adapters.

Provider listing URLs remain the application destination and are credited on cards and role details. Only identical canonical URLs are deduplicated; direct employer jobs take precedence. Existing verified employer jobs join the remote collection after their next regular refresh. Aggregator jobs remain outside the original board. The shared optional `remote` metadata is stored in job JSON; no SQL migration is required.

## Activation

1. Deploy the application changes.
2. Configure a **separate daily** cron-job.org job: `GET <APP_URL>/api/cron/remote-jobs`, header `Authorization: Bearer <CRON_SECRET>`, schedule `0 3 * * *` UTC (08:30 IST), request timeout 60 seconds, response-body storage off. Leave the existing employer/discovery schedules unchanged. Keep only one remote scheduler.
3. Run a test request and inspect the source receipts, `/updates`, and `/jobs/remote`. Do not assume deployment alone has populated jobs.

For manual recovery, run `pnpm jobs:refresh:remote` with `APP_URL` and `INGEST_TOKEN` in `.env.local`; it calls the deployed server, which owns database access. The endpoint accepts either the cron or ingestion credential. Never print credentials or put them in scheduler URLs.

## Freshness and failure behavior

The remote refresh has its own session advisory lock. HTTP requests have an 8-second timeout and share a 25-second fetch deadline; each response is limited to 8 MB. HN comments are limited to 10 pages of 100 per thread; reaching the cap is reported as partial. Each provider publishes transactionally in additive batches of at most 100. Failed sources cannot replace employer snapshots or close jobs. Last-seen metadata advances only for fetched and accepted records. Listings expire transactionally after 45 days without being seen, independently of source outages; tracker snapshots remain intact.

HTTP 200 means at least one source was processed, possibly with partial checks or other failed sources. HTTP 202 means another remote refresh holds the lock. HTTP 401 means the credential is missing or invalid. HTTP 503 means all providers failed or refresh infrastructure was unavailable. Source results and accepted counts appear in `/updates`.

Eligibility is conservatively parsed from source text, not a guarantee that an employer can legally hire every applicant. Candidates should review the linked original role and any timezone requirements.
