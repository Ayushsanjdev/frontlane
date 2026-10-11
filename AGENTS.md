# Repository Guidelines

## Project Structure & Module Organization
Frontlane is a Next.js App Router careers app using React, TypeScript, Tailwind CSS, and PostgreSQL. `app/` contains pages, global styles, and API route handlers. Shared UI lives in `components/`, with shadcn primitives in `components/ui/`. Use `hooks/` for shared hooks and `lib/` for types, authentication helpers, and utilities. `core/` contains database access, source adapters, and ingestion logic. `db/` holds SQL and seed data; `scripts/` provides operational commands. Tests live in `tests/`, static assets in `public/`, and ingestion documentation in `docs/`.

## Build, Test, and Development Commands
Use Node.js 22.13+ and install dependencies with `npm ci`.

- `npm run dev`: start the local Next.js server.
- `npm run build`: create the production build using webpack.
- `npm start`: serve the production build.
- `npm run typecheck`: check TypeScript without emitting files.
- `npm test`: run Node's built-in test runner.
- `npm run db:migrate`: apply the database schema; `npm run db:seed` loads optional seed data.
- `npm run jobs:refresh`: fetch and publish employer feeds.
- `npm run jobs:publish -- batch.json`: publish a validated research batch.

## Coding Style & Naming Conventions
Keep TypeScript strict and use `@/` imports for shared modules. Use PascalCase for React components, camelCase for functions and variables, and lowercase kebab-case filenames. Follow Next.js names such as `page.tsx` and `route.ts`. For new multiline code, use two-space indentation; preserve surrounding quote and semicolon conventions. Existing application code is compact, while UI primitives use expanded formatting. No formatter or lint script is configured. Reuse shared UI components and Tailwind utilities.

## Testing Guidelines
Name tests `tests/*.test.mjs`. Use `node:test`, strict assertions, and PGlite for database integration tests. Cover validation, replay conflicts, transactional behavior, source isolation, and private user access when changing related logic. No coverage threshold is configured. Run typecheck, tests, and build before submitting. For UI changes, check responsive layouts and themes manually.

## Commit & Pull Request Guidelines
Git history was unavailable during guide creation. Use concise imperative commit subjects describing one logical change. PRs should explain the behavior change, link relevant issues, report checks performed, and include screenshots for UI changes. Describe schema changes and required configuration updates.

## Security & Configuration
Copy `.env.example` to `.env.local`; never commit credentials. Configure PostgreSQL and Google OAuth before testing authenticated flows. Keep ingestion tokens in credential stores and preserve third-party licenses in `vendor/`.
