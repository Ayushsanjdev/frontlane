# Web App Guidelines

This workspace is the SvelteKit app. Pages and APIs live in `src/routes/`, shared
Svelte components in `src/lib/components/`, server-only logic in `src/lib/server/`,
and public assets in `static/`. Use `$lib/` imports within the web workspace.

Run commands from the repository root: `pnpm dev`, `pnpm build`,
`pnpm typecheck`, `pnpm test`, and `pnpm test:browser`. Install with
`pnpm install --frozen-lockfile`. Local web commands load the root `.env.local`.

Import shared logic through `@frontlane/core/*` and database exports through
`@frontlane/database/*`. Keep database imports in server-only modules. Keep
authentication here; ingestion, validation and query logic belong in `packages/core/`.

Use Svelte 5 runes, strict TypeScript, two-space indentation, generated route
types and the existing shared UI components. Route handlers take SvelteKit
request events; identities must come from request-local sessions. Protect each
private page load and API handler individually. Preserve JSON endpoint contracts
and the Google OAuth callback at `/api/auth/callback/google`.

Add dependencies to this workspace with `pnpm --filter @frontlane/web add <package>`.
SvelteKit and its adapters must remain compatible with Auth.js peer requirements.
Use Vite integration for Tailwind. Normal builds use the Node adapter; Vercel
builds use the Vercel adapter. Keep third-party licenses in `vendor/`.

Use the semantic tokens in `src/app.css` for both themes. Check all pages at
mobile and desktop widths, keyboard focus and dialog dismissal. Browser test
fixtures live in root `tests/helpers/` and must not introduce a production auth
bypass or write to the configured production database.
