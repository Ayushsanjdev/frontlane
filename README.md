# Frontlane

A frontend careers product owned and developed by Ayush Sanj. This version runs standard Next.js on any compatible Node.js or Docker host with PostgreSQL. It does not need ChatGPT hosting, Cloudflare D1, Vinext, or Sites identity headers.

## Start

1. Install Node.js 22.13+ and PostgreSQL. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and set your database URL, app URL and secrets. Generate separate secrets with `openssl rand -hex 32`.
3. Create a Google OAuth web application in your own Google Cloud account. Configure its redirect URI as `https://YOUR-DOMAIN/api/auth/callback/google` (localhost can use HTTP). Set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `AUTH_URL` and `APP_URL`. Put production values in the hosting secret manager.
4. Run `npm run db:migrate`, optionally `npm run db:seed`, then `npm run dev`.
5. For production run `npm run build` and `npm start`, or build the included Dockerfile. Set the same runtime variables on the host. `compose.yaml` can run the app and PostgreSQL together; set POSTGRES_PASSWORD in the compose environment first. Existing volumes require explicit migrations when the schema changes.

Google sign-in is implemented but must be configured with your real OAuth credentials. No Google account or infrastructure account was created for you. The seed retains real research dates and is optional.

## Twice-daily updates

Use one scheduler, not all three:

- **GitHub Actions:** push this folder to your repository, set repository variable APP_URL and secret INGEST_TOKEN, then enable `.github/workflows/jobs.yml`. It runs at 02:30 and 12:30 UTC (8 AM/6 PM IST). Runs may be delayed by GitHub. No database secret is needed by this worker.
- **Your server cron:** install this project on the worker and set APP_URL and INGEST_TOKEN in a protected `.env.local`. With the server configured for UTC, use `30 2,12 * * * cd /absolute/path/frontlane && npm run jobs:refresh`. Keep logs outside the public directory and monitor failures.
- **Hosting cron:** request `GET /api/cron/jobs` with `Authorization: Bearer CRON_SECRET`. The route locks concurrent refreshes. `vercel.json` is supplied as an option; check your hosting plan's cron frequency and execution-duration limits before enabling it. The external worker avoids long-running requests on the app host.

The public GET /api/jobs is read-only. Source updates are shared centrally, not performed for every visitor. The included worker reads nine free public employer feeds, verifies India/worldwide locations, normalizes records, and publishes complete snapshots only after successful source retrieval. A failed source preserves previous jobs. This cannot guarantee new vacancies appear in every run.

## Add researched jobs from ChatGPT

POST a validated JSON batch to `/api/ingest/jobs` with `Authorization: Bearer INGEST_TOKEN`; see `docs/CHATGPT-UPDATER.md`. Or save the research batch locally and run `npm run jobs:publish -- batch.json`. This supports freelance, part-time and contract jobs alongside employment listings. The endpoint only writes public job data and ingestion receipts; it cannot write profiles or application records.

The API and publication script are implemented. Automated ChatGPT publication is **not activated** until the deployed URL and supported authenticated connector/runner are configured. Merely scheduling a ChatGPT conversation is insufficient. Keep the token in a credential store, never a prompt or public repository. The included employer-feed worker runs independently of ChatGPT once its scheduler is configured.

## Product features

Responsive landing page; light/dark/system themes; Google authentication; server-side job search/filtering/pagination; job details with eligibility and separate discovery/posting/verification dates; personal profile; private editable application tracker with notes, exact answers, evidence, follow-ups and CSV export. Tracker retrieval currently caps at 1,000 rows and needs cursor pagination for very large personal histories.

## Checks

`npm run typecheck`, `npm test`, `npm run build`. Tests use embedded PostgreSQL to exercise actual ingestion SQL, duplicate handling, retries, conflicts, source-scoped closures, validation and row-scoped queries. Browser visual QA, Docker image execution, a live managed PostgreSQL deployment, real Google OAuth and load certification require the corresponding environment; do not claim they passed based on compilation.

## Scaling and operations

Use a managed PostgreSQL pooler for many serverless instances, keep DB_POOL_SIZE bounded, cache only public jobs, and run ingestion separately from app requests. Add source adapters rather than per-user scraping. Monitor source failures, refresh age and database saturation. Before a large launch, add account deletion, stronger abuse rate limiting, cursor pagination, backup/restore drills and realistic load tests. Free source APIs do not imply unlimited free hosting.

## Ownership and licensing

Keep this repository, domain, hosting, database and Google OAuth project under your accounts. Third-party component/library licenses remain applicable; preserve included license files. This package has no inherited hosting project ID, bearer credentials or private user data. The earlier published demo remains separate.
