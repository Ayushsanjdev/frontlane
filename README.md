# Frontlane

A frontend careers product owned and developed by Ayush Sanj. This version runs standard Next.js on any compatible Node.js or Docker host with PostgreSQL. It does not need ChatGPT hosting, Cloudflare D1, Vinext, or Sites identity headers.

## Workspace layout

- `apps/web`: Next.js pages, APIs, authentication, UI, and app configuration (`@frontlane/web`).
- `apps/worker`: employer-feed refresh and research publication commands (`@frontlane/worker`).
- `packages/core`: shared ingestion, validation, job search, and source adapters (`@frontlane/core`).
- `packages/database`: PostgreSQL access, schema, migrations, and curated data (`@frontlane/database`).
- Root `tests/`, `scripts/`, and `docs/`: integration checks, seed orchestration, and operational documentation.

Use package exports and `workspace:*` dependencies across these boundaries. The root `pnpm-lock.yaml` is the only lockfile. Add dependencies to their owning workspace, for example `pnpm --filter @frontlane/web add <package>`.

## Start

1. Install Node.js 22.13+ and PostgreSQL. Enable Corepack with `corepack enable`, then run `pnpm install --frozen-lockfile`. The repository pins pnpm 11.24.0.
2. At the repository root, copy `.env.example` to `.env.local` and set your database URL, app URL and secrets. Generate separate secrets with `openssl rand -hex 32`.
3. Create a Google OAuth web application in your own Google Cloud account. Configure its redirect URI as `https://YOUR-DOMAIN/api/auth/callback/google` (localhost can use HTTP). Set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `AUTH_URL` and `APP_URL`. Put production values in the hosting secret manager.
4. Run `pnpm db:migrate`, optionally `pnpm db:seed`, then `pnpm dev`.
5. For production run `pnpm build` and `pnpm start`, or build the included Dockerfile. Set the same runtime variables on the host. `compose.yaml` can run the app and PostgreSQL together; set POSTGRES_PASSWORD in the compose environment first. Existing volumes require explicit migrations when the schema changes.

Google sign-in is implemented but must be configured with your real OAuth credentials. No Google account or infrastructure account was created for you. Run the root commands from the repository root. Web and worker scripts load the root `.env.local`; deployment environment variables are inherited normally. Batch paths passed to `pnpm jobs:publish batch.json` resolve from your invoking directory.

The shared curated dataset in `packages/database/data/seed.json` retains research dates and is optional. The homepage and board use live jobs when the database is available; curated fallback data is labeled when live retrieval fails.

## Deployment

Docker builds from the repository root and runs `apps/web/server.js` from the monorepo standalone output. Compose initializes PostgreSQL from `packages/database/schema/001-init.sql`.

For Vercel, set the project Root Directory to `apps/web`, enable access to source files outside that directory, and use the workspace's Next.js build. Set `ENABLE_EXPERIMENTAL_COREPACK=1` so the deployment honors the pinned pnpm version ([Vercel Corepack setup](https://vercel.com/docs/builds/configure-a-build#corepack)). Its `apps/web/vercel.json` contains the optional hosting cron. Install dependencies from the workspace root; enable only one ingestion scheduler.

The worker can run independently with `pnpm --filter @frontlane/worker refresh`; it needs APP_URL and INGEST_TOKEN, while the deployment owns database credentials.

## Twice-daily updates

Use one scheduler, not all three:

- **GitHub Actions:** push this folder to your repository, set repository variable APP_URL and secret INGEST_TOKEN, then enable `.github/workflows/jobs.yml`. It runs at 02:30 and 12:30 UTC (8 AM/6 PM IST). Runs may be delayed by GitHub. No database secret is needed by this worker.
- **Your server cron:** install this project on the worker and set APP_URL and INGEST_TOKEN in a protected `.env.local`. With the server configured for UTC, use `30 2,12 * * * cd /absolute/path/frontlane && pnpm jobs:refresh`. Keep logs outside the public directory and monitor failures.
- **Hosting cron:** request `GET /api/cron/jobs` with `Authorization: Bearer CRON_SECRET`. The route locks concurrent refreshes. `apps/web/vercel.json` is supplied as an option; check your hosting plan's cron frequency and execution-duration limits before enabling it. The external worker avoids long-running requests on the app host.

The public GET /api/jobs is read-only. Source updates are shared centrally, not performed for every visitor. The included worker reads nine free public employer feeds, verifies India/worldwide locations, normalizes records, and publishes complete snapshots only after successful source retrieval. A failed source preserves previous jobs. This cannot guarantee new vacancies appear in every run.

## Add researched jobs from ChatGPT

POST a validated JSON batch to `/api/ingest/jobs` with `Authorization: Bearer INGEST_TOKEN`; see `docs/CHATGPT-UPDATER.md`. Or save the research batch locally and run `pnpm jobs:publish batch.json`. This supports freelance, part-time and contract jobs alongside employment listings. The endpoint only writes public job data and ingestion receipts; it cannot write profiles or application records.

The API and publication script are implemented. Automated ChatGPT publication is **not activated** until the deployed URL and supported authenticated connector/runner are configured. Merely scheduling a ChatGPT conversation is insufficient. Keep the token in a credential store, never a prompt or public repository. The included employer-feed worker runs independently of ChatGPT once its scheduler is configured.

## Product features

Responsive landing page; light/dark/system themes; Google authentication; server-side job search/filtering/pagination; job details with eligibility and separate discovery/posting/verification dates; personal profile; private editable application tracker with notes, exact answers, evidence, follow-ups and CSV export. Tracker retrieval currently caps at 1,000 rows and needs cursor pagination for very large personal histories.

## Checks

`pnpm typecheck`, `pnpm test`, `pnpm build`. Ingestion tests use embedded PostgreSQL to exercise actual SQL, duplicate handling, conflicts, source-scoped closures and savepoint recovery. Route tests exercise authentication boundaries, origin checks, validation and user-scoped queries with controlled session/database fixtures. Focused checks can run with `pnpm test:focused`. Browser visual QA, Docker image execution, a live managed PostgreSQL deployment, real Google OAuth and load certification require the corresponding environment; do not claim they passed based on compilation.

## Scaling and operations

Use a managed PostgreSQL pooler for many serverless instances, keep DB_POOL_SIZE bounded, cache only public jobs, and run ingestion separately from app requests. Add source adapters rather than per-user scraping. Monitor source failures, refresh age and database saturation. Before a large launch, add account deletion, stronger abuse rate limiting, cursor pagination, backup/restore drills and realistic load tests. Free source APIs do not imply unlimited free hosting.

## Ownership and licensing

Keep this repository, domain, hosting, database and Google OAuth project under your accounts. Third-party component/library licenses remain applicable; preserve included license files. This package has no inherited hosting project ID, bearer credentials or private user data. The earlier published demo remains separate.
