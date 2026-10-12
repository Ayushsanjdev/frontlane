# Web App Guidelines

This workspace is the Next.js app. Paths such as `app/`, `components/`, `lib/`, and `public/` are relative to `apps/web/`. The `@/` alias resolves within this workspace.

Run commands from the repository root: `pnpm dev`, `pnpm build`, `pnpm typecheck`, and `pnpm test`. Install with `pnpm install --frozen-lockfile`. Local web commands load the root `.env.local`.

Import shared logic through `@frontlanejobs/core/*` and database exports through `@frontlanejobs/database/*`; avoid relative imports across workspace boundaries. Keep UI and authentication here. Shared ingestion, validation, and query logic belong in `packages/core/`.

Preserve strict TypeScript, two-space indentation for multiline code, and the existing UI primitives. Add dependencies to the workspace that imports them using `pnpm --filter @frontlanejobs/web add <package>`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
