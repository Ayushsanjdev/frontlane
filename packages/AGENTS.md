# Shared Package Guidelines

`core/` owns ingestion, source adapters, search, validation, and refresh locking. `database/` owns the PostgreSQL pool, schema, migration command, and curated data.

Use package exports (`@frontlane/core/*`, `@frontlane/database/*`) across boundaries. Declare every external import in the importing package's manifest. The dependency direction is core → database; database must not depend on core or either app.

Run `pnpm test` from the repository root. Tests are in root `tests/`; ingestion integration tests use PGlite. Run `pnpm db:migrate` and `pnpm db:seed` for database setup. The root `.env.local` supplies local operational commands.

Keep schema and ingestion changes transactional. Preserve replay handling, source isolation, validation, and caller-owned savepoint recovery.
