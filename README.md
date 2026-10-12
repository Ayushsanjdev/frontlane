# Frontlane

A careers app for frontend engineers in India, built with Next.js, React, TypeScript, Tailwind CSS, and PostgreSQL. Browse employment and freelance opportunities, sign in with Google, and manage a private application tracker.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `apps/web/` | Next.js pages, APIs, authentication, and UI |
| `apps/worker/` | Employer-feed refresh and research publication commands |
| `packages/core/` | Shared validation, queries, ingestion, and source adapters |
| `packages/database/` | PostgreSQL access, schema, migrations, and curated data |
| `scripts/` | Seed orchestration |
| `tests/` | Unit and integration tests |
| `docs/` | Ingestion documentation |

## Getting started

Use Node.js 22.13+ and the pnpm version pinned in `package.json`. With nvm installed, run `nvm use`. Enable Corepack with `corepack enable`, then run all commands from the repository root:

```sh
pnpm install --frozen-lockfile
cp -n .env.example .env.local
```

Set `DATABASE_URL`, `APP_URL`, and the authentication settings in `.env.local`. Generate separate `AUTH_SECRET`, `INGEST_TOKEN`, and `CRON_SECRET` values with `openssl rand -hex 32`. Keep existing values when updating a local environment file.

For Google sign-in, configure a Google OAuth web application with the redirect URI `http://localhost:3000/api/auth/callback/google`. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`; production uses the deployed domain and HTTPS. Set `AUTH_URL` to the same app origin.

With PostgreSQL running:

```sh
pnpm db:migrate
pnpm db:seed # Optional curated starter data
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Local web and worker commands load the root `.env.local`. Curated fallback data is labeled when live job retrieval fails; an available database with no jobs shows an empty collection.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Build the production app |
| `pnpm start` | Serve the production build |
| `pnpm typecheck` | Check TypeScript |
| `pnpm test` | Run the full test suite |
| `pnpm test:focused` | Run route, reliability, workspace, and worker tests |
| `pnpm db:migrate` | Apply the database schema |
| `pnpm db:seed` | Load optional curated jobs |
| `pnpm jobs:refresh` | Fetch and publish employer feeds |
| `pnpm jobs:publish batch.json` | Publish a validated research batch |

Add dependencies to the workspace that imports them, for example `pnpm --filter @frontlane/web add <package>`. Use package exports and `workspace:*` dependencies across workspace boundaries. Keep `pnpm-lock.yaml` as the only lockfile.

Before submitting changes, run `pnpm typecheck`, `pnpm test`, and `pnpm build`. Database integration tests use PGlite and do not require a running PostgreSQL server. For UI changes, check responsive layouts and both themes. See [AGENTS.md](AGENTS.md) for contributor guidelines.

## PostgreSQL and Neon

The app accepts a standard PostgreSQL connection string. Set `DB_SSL` according to your provider and keep `DB_POOL_SIZE` bounded when running multiple instances.

For Neon, `neon.ts` contains the database configuration. Install the Neon CLI, authenticate with `neon login`, and link your project with `neon link --project-id YOUR_PROJECT_ID --branch YOUR_BRANCH -y`. The local `.neon` link and credentials are gitignored. `neon deploy` reconciles Neon infrastructure; deploy the Next.js app separately.

Use pooled `DATABASE_URL` for application queries and a direct connection for migrations. After Neon supplies `DATABASE_URL_UNPOOLED`, apply the schema with:

```sh
node --env-file-if-exists=.env.local --input-type=module -e 'process.env.DATABASE_URL=process.env.DATABASE_URL_UNPOOLED; await import("./packages/database/scripts/migrate.mjs")'
```

Use a separate database branch for development and migration testing. Never commit connection strings or credentials.

## Deployment

- **Node.js:** set runtime environment variables, run `pnpm build`, then `pnpm start`.
- **Docker:** build the root `Dockerfile`. It runs the monorepo standalone output as a non-root user.
- **Compose:** set `POSTGRES_PASSWORD` in the Compose environment and run `docker compose up --build`. Compose initializes new PostgreSQL volumes from the checked-in schema; existing volumes require explicit migrations.
- **Vercel:** set Root Directory to `apps/web`, enable source access outside that directory, and set `ENABLE_EXPERIMENTAL_COREPACK=1` to honor the pinned pnpm version. Install from the workspace root and configure production secrets in the hosting dashboard.

Configure Google OAuth with the deployed callback URL. Keep secrets in your hosting secret manager.

## Job ingestion

Configure one scheduler:

- **GitHub Actions:** set repository variable `APP_URL` and secret `INGEST_TOKEN`. `.github/workflows/jobs.yml` runs daily at 02:30 UTC (8 AM IST); GitHub may delay scheduled runs.
- **Server cron:** set `APP_URL` and `INGEST_TOKEN` on the worker. For a server using UTC, run `30 2 * * * cd /absolute/path/frontlane && pnpm jobs:refresh`.
- **Hosting cron:** `apps/web/vercel.json` schedules `GET /api/cron/jobs`. Requests require `Authorization: Bearer CRON_SECRET`; configure the secret and check your host's frequency and execution-duration limits.

The daily refresh targets **50 available frontend jobs** eligible for India or explicitly worldwide remote work. It reads public Greenhouse, Lever, and SmartRecruiters employer feeds, deduplicates application URLs, and selects across employers, employment types, and remote/hybrid/onsite arrangements. Every automated listing links to the employer-provided career page or hosted ATS posting. Part-time, contract, and freelance roles are included when employers supply them; no fixed mix or 50-job minimum is guaranteed by upstream availability.

Each successful employer snapshot replaces that employer's portion of the daily selection, so jobs outside the current selection become inactive. Failed or malformed sources retain their previous listings. Manual/research and starter listings are independent and remain untouched, so the total board can exceed 50. The worker output and cron response include `summary.target`, `published`, `shortfall`, and `failedSources`. A complete source failure returns HTTP 503 or a nonzero worker exit status; a shortfall is reported without inventing listings. `/updates` shows per-source selected counts and check times.

For production, enable **only one** scheduler above. On Vercel, deploy the committed cron configuration and set `DATABASE_URL` and a separate `CRON_SECRET` of at least 32 characters. With GitHub Actions, point `APP_URL` at the production HTTPS origin and configure the matching `INGEST_TOKEN` in both GitHub and the app. Use the workflow's **Run workflow** button or `pnpm jobs:refresh` for the initial refresh, then inspect its summary and `/updates`. Localhost does not run the production schedule automatically.

The external worker needs `APP_URL` and `INGEST_TOKEN`, without database credentials. Failed source retrieval preserves existing jobs. The public `/api/jobs` endpoint is read-only.

For researched jobs, publish a JSON batch with `pnpm jobs:publish batch.json` or authenticated `POST /api/ingest/jobs`. Batch paths resolve from your invoking directory. See [the research publication guide](docs/CHATGPT-UPDATER.md) for the schema, retry behavior, and runner instructions. Automated ChatGPT publication requires a configured authenticated connector or runner.

## Operational limits

Tracker retrieval currently caps at 1,000 rows. Before a large launch, address cursor pagination, account deletion, abuse rate limiting, backup and restore drills, and load testing. Compilation and local integration tests do not verify live OAuth, deployment behavior, or production capacity.

## Third-party licenses

Preserve the included shadcn license in `apps/web/vendor/` and licenses of other third-party dependencies.
