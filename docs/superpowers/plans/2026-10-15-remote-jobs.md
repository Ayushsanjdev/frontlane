# Remote Jobs Implementation Plan

Goal: Add /jobs/remote and a Remote only switch for frontend jobs explicitly eligible from India, using free Remote OK, WWR, and HN feeds.

Architecture: Shared eligibility evidence in optional job metadata; collection-aware existing queries; isolated additive remote refresh with bounded fetching and 45-day expiry. Existing employer snapshots and 50-job selection remain unchanged.

## Tasks
- [x] 1. Add eligibility classifier, optional validated metadata, collection queries and saved-search support. Test restrictions and SQL/fallback parity.
- [x] 2. Add bounded provider adapters, HN extraction, transactional refresh/status/expiry, protected cron and worker. Test failures, isolation, replay, and expiry.
- [x] 3. Add shared board route, switch/tooltip, attribution and eligibility display, navigation and saved-search links.
- [x] 4. Run typecheck, full tests, production build, responsive/theme checks, and independent review. Document activation.

## Decisions
- Use the current workspace to keep changes directly reviewable; no commits or deployment requested.
- HN uses Algolia search pagination, validates top-level comments and thread author/title, and excludes ambiguous role blocks.
- Remote refresh uses its own database lock and a 25-second fetch deadline; no source may replace a complete employer snapshot.
- Remote expiry runs only during remote refresh, using remote metadata lastSeen. A feed failure does not refresh timestamps.
- Only canonical application URLs are merged; provider-specific source links remain visible.

## Validation
Use node:test/PGlite for ingestion, source isolation, failures, deduplication, query parity and expiry; mocked HTTP for providers and routes. Run pnpm typecheck, pnpm test and pnpm build. Inspect mobile/desktop and light/dark.

## Verification progress
- Eligibility/query/schema tests passed with SQL/fallback parity, exact-URL preference and source isolation.
- Provider tests passed, including malformed XML, provider failures, HN page caps, 8 MB cap, expiry and failure of a second ingestion chunk with source-wide rollback.
- Live read-only fetch: all three sources returned valid feeds; one eligible WWR job, zero eligible Remote OK/HN jobs at that moment. No live jobs were ingested.
- Independent review: fixed work-authorization and hire-outside conflicts, company-reach false positives, and collection starvation before recommendation LIMIT. Each reproduced in failing tests, then passed.
- Browser: 1440px desktop and 390px mobile, dark/light, switch filter preservation, clear filters, back navigation, focus/click tooltip and Escape. Populated card/detail rendering used a temporary browser-only fixture, with no database writes.
- Review limitations: reviewer did not independently exercise browser history/layout, live feeds or licensing; executor checked these separately. Production deployment and scheduler activation remain operator steps.

Final checks: pnpm typecheck passed (web and mobile); pnpm test passed 146/146; pnpm build passed; git diff --check passed. Changes remain uncommitted in the requested workspace.
