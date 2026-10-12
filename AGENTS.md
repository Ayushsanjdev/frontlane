# Repository Guidelines

## Project Structure & Module Organization
frontlanejobs is a pnpm monorepo using Svelte 5, SvelteKit, TypeScript, Tailwind CSS, and PostgreSQL. `apps/web/` contains pages, API routes, authentication, shared UI, and static assets. `apps/worker/` provides ingestion commands. `packages/core/` owns shared validation, queries, source adapters, and ingestion logic. `packages/database/` owns database access, SQL, migrations, and seed data. Root `scripts/` provides seed orchestration, `tests/` contains integration tests, and `docs/` contains operational documentation. Follow the scoped guidelines in `apps/web/AGENTS.md` and `packages/AGENTS.md`.

## Build, Test, and Development Commands
Use Node.js 22.13+ (`nvm use` selects Node 22) and the pnpm version pinned in `package.json`. Install from the repository root with `pnpm install --frozen-lockfile`. Keep `pnpm-lock.yaml` as the only lockfile.

- `pnpm dev`: start the local SvelteKit/Vite server.
- `pnpm build`: create the production build using Vite and the selected SvelteKit adapter.
- `pnpm start`: serve the production build.
- `pnpm typecheck`: check Svelte components and TypeScript without emitting files.
- `pnpm test`: run Node's built-in test runner.
- `pnpm db:migrate`: apply the database schema; `pnpm db:seed` loads optional seed data.
- `pnpm jobs:refresh`: fetch and publish employer feeds.
- `pnpm jobs:publish batch.json`: publish a validated research batch.

## Coding Style & Naming Conventions
Keep TypeScript strict. Use `$lib/` imports within `apps/web/src/` and `@frontlanejobs/core/*` or `@frontlanejobs/database/*` exports across workspace boundaries. Use PascalCase for Svelte components, camelCase for functions and variables, and lowercase kebab-case filenames. Follow SvelteKit names such as `+page.svelte`, `+page.server.ts`, and `+server.ts`. For new multiline code, use two-space indentation; preserve surrounding quote and semicolon conventions. Existing application code is compact, while UI primitives use expanded formatting. No formatter or lint script is configured. Reuse shared UI components and Tailwind utilities.

## Testing Guidelines
Name tests `tests/*.test.mjs`. Use `node:test`, strict assertions, and PGlite for database integration tests. Cover validation, replay conflicts, transactional behavior, source isolation, and private user access when changing related logic. No coverage threshold is configured. Run typecheck, tests, and build before submitting. For UI changes, run `pnpm test:browser` and inspect responsive layouts and both themes. Browser tests live in `tests/browser/`; test helpers must stay outside production code.

## Commit & Pull Request Guidelines
Use concise imperative commit subjects describing one logical change. PRs should explain the behavior change, link relevant issues, report checks performed, and include screenshots for UI changes. Describe schema changes and required configuration updates.

## Security & Configuration
Copy `.env.example` to `.env.local`; never commit credentials. Configure PostgreSQL and Google OAuth before testing authenticated flows. Keep ingestion tokens in credential stores and preserve third-party licenses in `vendor/`.
