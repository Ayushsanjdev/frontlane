# Explore collections

`/explore` links to FAANG, Big Tech, Established Product Companies, Growth Startups, Services Companies, Recently Funded and Fresher Special. `/companies` remains the complete directory, including curated companies with no selected jobs. Collections share the existing board, filters, tracker, recommendations and saved-search alerts.

## Local and production setup

Explore requires **no new environment variables, API keys, paid services, database tables or migration**. The company catalog ships with the application and is identical locally and in production. Existing `.env.local` values remain in use; do not replace them with production credentials.

For a new local checkout, copy `.env.example` to `.env.local`, configure the existing PostgreSQL and optional OAuth settings, then run:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

Visit `http://localhost:3000/explore`. Browsing works without OAuth. When PostgreSQL is unavailable, job results and counts use the existing curated fallback, labeled as such; company context and careers links remain available.

The existing `pnpm jobs:refresh` command and jobs cron reseed the employer registry before selecting sources. Stripe and Figma Greenhouse boards were checked as public feeds on 2026-10-15 and are included in the same refresh rotation locally and in production. Run the local server with its local `APP_URL` before invoking this command. It uses the existing `INGEST_TOKEN`; no separate Explore token or production-only setting is needed. Adding a source does not guarantee that it currently has eligible frontend openings.

## Company catalog

Edit `packages/database/data/companies.json`:

- Use a stable lowercase kebab-case `id`, a display `name`, and explicit `aliases`. Name matching trims and lowercases exact aliases; it never uses fuzzy matching.
- `sources` contains lowercased provider identifiers, such as `greenhouse:harnessinc`. Known source identity takes precedence over display-name aliases. Never map the same source or alias to different companies.
- `careersUrl` links to official careers; `evidenceUrl` supports the company context and classification. Verify both before adding or changing a record.
- `groups` uses `faang`, `big-tech`, `established-product`, `growth-startups`, or `services`. Groups overlap and are editorial navigation, not quality tiers. FAANG contains Meta, Amazon, Apple, Netflix and Alphabet/Google and is included within Big Tech. The initial wider Big Tech list adds Microsoft, NVIDIA and Adobe.
- Established product companies operate their own mature products; growth startups are privately backed product teams; services companies focus on client engineering and consulting. These descriptions are not exhaustive objective certifications. Review membership as businesses change.

Canonical company pages use `/companies/<id>` and collect matching active jobs across explicit sources and aliases. Existing known provider-based company links redirect to their canonical page. Previously published jobs do not need a backfill: queries resolve their identities against the current catalog, while new publications also store `companyId`.

Unsupported FAANG/Big Tech providers use official careers links. Add individually verified frontend roles through the existing `pnpm jobs:publish batch.json` research workflow; do not invent listings, bypass publication validation, or replace an employer snapshot with research data.

## Funding maintenance

Each company's `funding` array contains `announced` (`YYYY-MM-DD`), `sourceUrl`, and optional confirmed `round` and `amount`. Use a dated company announcement or reliable primary source. Preserve distinctions between completed capital, announced raises and planned tenders in the displayed text. Initial records link to Harness's December 2025 financing announcement and Databricks' December 2025 Series L announcement.

Recently Funded shows the most recent qualifying announcement per company, newest first. Eligibility uses the inclusive preceding 12 calendar months through today's UTC date, with leap-day clamping. Future announcements are excluded; older records automatically leave the collection. Retain historical records in the catalog. Verify dates and links during editorial updates; there is no automatic funding-news subscription. Funding does not imply hiring.

## Fresher eligibility and query filters

Fresher Special accepts explicitly named internships, graduate/new-grad/fresher/entry-level roles, explicit no-experience requirements, or a confirmed minimum of zero or one year. A range such as 0–3 years can accept a fresher because its required minimum is zero; a range's upper bound alone is not a higher required minimum. Any detected conflicting minimum above one year or senior/mid/lead/staff requirements excludes the role. Unknown experience by itself is insufficient. Keep the evidence in the listing description and employer requirements; do not infer fresher eligibility from company reputation.

Internships retain their source employment type and use optional `enrichment.careerStage` (`Internship`, `Graduate`, `Entry-level`) rather than introducing a new employment-type enum. Employer ingestion now admits frontend internships through its existing India-first eligibility rules.

The jobs interface accepts `companyGroup`, `companyId`, `recentlyFunded=1`, and `freshers=1`; these combine independently with `collection=remote`, search and the existing filters. Unknown company groups yield no matches. Collection pages pin their own selection, and Clear filters preserves it. Company-card counts cover the collection before additional job-search refinements.

## Verification

Run `pnpm typecheck`, `pnpm test` and `pnpm build`. Explore tests cover SQL/fallback agreement, exact identity, geography boundaries, funding dates, fresher conflicts, remote duplicate counts, recommendations before the candidate cap, private alerts and internship tracker validation. Manually check collection links, Remote only, clear filters, browser history, company careers links, mobile layouts, light/dark themes and visible keyboard focus.

## Expanded free feeds

The registry includes 53 seeded employer boards, including Amazon and seven verified Ashby boards. Complete refreshes expose all eligible inventory; the 50-role selection only controls featured placement. Explore also admits India/worldwide remote aggregator roles and deduplicates copies. Every seeded employer has an exact catalog mapping. Source health displays actual successful timestamps, failures and pending first checks. An available feed can legitimately have zero matching frontend roles. Funding announcements remain curated.

Apply migration `011-expanded-feeds.sql` before refresh. No new environment variables are needed; local `.env.local` remains the operational source. See [scheduler setup](CRON-JOB-ORG.md).
