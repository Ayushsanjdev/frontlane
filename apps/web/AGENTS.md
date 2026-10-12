# Web App Guidelines

This workspace is the Next.js app. Paths such as `app/`, `components/`, `lib/`, and `public/` are relative to `apps/web/`. The `@/` alias resolves within this workspace.

Run commands from the repository root: `pnpm dev`, `pnpm build`, `pnpm typecheck`, and `pnpm test`. Install with `pnpm install --frozen-lockfile`. Local web commands load the root `.env.local`.

Import shared logic through `@frontlane/core/*` and database exports through `@frontlane/database/*`; avoid relative imports across workspace boundaries. Keep UI and authentication here. Shared ingestion, validation, and query logic belong in `packages/core/`.

Preserve strict TypeScript, two-space indentation for multiline code, and the existing UI primitives. Add dependencies to the workspace that imports them using `pnpm --filter @frontlane/web add <package>`.
