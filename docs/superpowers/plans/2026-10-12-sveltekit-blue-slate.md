# SvelteKit and blue/slate implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox syntax for tracking.

**Goal:** Replace Frontlane's Next.js web app with SvelteKit and redesign every page in blue and slate.

**Architecture:** Keep the core/database packages and JSON API contracts. Move request handling to SvelteKit events, server data to server-only modules, and UI to Svelte components with shared tokens.

**Tech stack:** Svelte 5, SvelteKit, Vite, TypeScript, Tailwind 4, Auth.js, Lucide, Node and Vercel adapters, Node tests/PGlite, Playwright browser checks.

**Spec:** `docs/superpowers/specs/2026-10-12-sveltekit-blue-slate-design.md`

## Global constraints

- Keep pnpm workspaces and `pnpm-lock.yaml` as the only lockfile.
- Preserve strict TypeScript and the public URL/API contracts.
- Preserve private account ownership and `google:<providerAccountId>` identities.
- Persist the existing `frontlane-theme` preference.
- Preserve third-party license files and root `.env.local` loading.
- Execute inline on the requested feature branch. The user's “do it” authorizes implementation of the presented design.

## Review focus

- Concurrent requests from different users must never share an identity.
- Backslash, protocol-relative, and absolute return URLs must not redirect off-site.
- Database/auth configuration outages must leave public browsing usable and private data protected.
- Rapid filter changes and modal opening/closing must not show stale data or lose keyboard focus.
- Production output must resolve workspace packages, static assets, root environment values, and the existing OAuth callback path.

### Task 1: SvelteKit runtime and server contracts

Files: `apps/web/package.json`, `vite.config.ts`, `svelte.config.js` if supported by the selected version, `tsconfig.json`, `src/app.html`, `src/app.d.ts`, `src/hooks.server.ts`, `src/lib/server/{auth,session,auth-api,jobs,seed}.ts`, `src/routes/api/**/+server.ts`, and `tests/{routes,session,viewers,web-launch}.test.mjs` plus test loaders.

Interfaces: handlers take `RequestEvent`; `getUser(locals)` returns the existing user shape or null; `requireUser(locals,path)` redirects anonymous requests; `jobCollection(params)` and `jobDetail(id)` preserve their response types.

- [x] Adapt existing route tests to call handlers with `{request,locals,url}` and add simultaneous request-local identities and unsafe return URL cases.
- [x] Run `node --test tests/routes.test.mjs tests/session.test.mjs tests/viewers.test.mjs tests/web-launch.test.mjs`; observe failures against the previous framework contract.
- [x] Install compatible Svelte dependencies, implement server boundary adapters and Auth.js hooks with `/api/auth`, migrate all API routes, and replace launcher-specific tests with env-loading subprocess checks.
- [x] Run the same targeted tests and `pnpm typecheck`; expected: server contracts pass, with UI work tracked separately until Task 2.

### Task 2: Complete UI migration and redesign

Files: `src/routes/**/+page.svelte`, `+page.server.ts`, `+layout.svelte`, `+layout.server.ts`, `+error.svelte`, `src/lib/components/*.svelte`, `src/lib/{types,viewer-heartbeat,tracker-csv}.ts`, `src/app.css`, and `static/favicon.svg`.

Interfaces: layout data exposes `user`; home/jobs loads expose `JobCollection`; tracker loads expose `Application[]` plus a retrieval error; account load returns profile or a load error. Client writes use the preserved JSON endpoints.

- [x] Retain all existing backend behavior tests and add CSV formula-escaping coverage before extracting the export helper.
- [x] Implement blue/slate tokens, shared layout, accessible native dialog, theme persistence, viewer counts, and local typography.
- [x] Port home, job filters/detail/save flow, tracker create/edit/delete/export, account form, sign-in/out, updates, and about pages.
- [x] Run `pnpm typecheck` and `pnpm test`; expected: all checks pass, no Svelte accessibility warnings.
- [x] Inspect responsive layouts and themes in a browser; exercise filters, deep links, pagination, keyboard dialogs, anonymous sign-in boundaries, and private forms using test fixtures.

### Task 3: Production delivery and branch review

Files: `Dockerfile`, `.dockerignore`, `.gitignore`, `pnpm-workspace.yaml`, `apps/web/vercel.json`, `README.md`, `AGENTS.md`, `apps/web/AGENTS.md`, and migration browser tests.

Interfaces: `pnpm dev` listens on port 3000; `pnpm build` emits the adapter output; `pnpm start` runs Node output; Vercel keeps `/api/cron/jobs` and its schedule.

- [x] Remove superseded Next/React files and dependencies after parity; preserve vendor licenses.
- [x] Update Node/Docker/Vercel deployment and contributor documentation.
- [x] Run frozen install, typecheck, full tests, production build, and production HTTP/browser smoke checks. Record any unavailable live OAuth or Docker verification.
- [x] Request one fresh whole-branch code review, resolve material findings, and rerun affected checks.
- [x] Leave the finished changes on the requested branch and report validation and remaining operational limits.

## Execution record

- Baseline: 54/54 tests passed before implementation.
- Design approved by the user's “do it”; proceed through all tasks inline.

- Completed all three tasks on `feat/sveltekit-blue-slate`.
- Frozen pnpm install passed, including the narrow Auth.js base-path patch.
- `pnpm typecheck`: zero errors and warnings. `pnpm test`: 60/60 passed.
- Playwright: 10/10 passed, including tracker CRUD/CSV, profiles, account isolation,
  OAuth callback path, cancellation regression, dialogs and seven pages at 320,
  390, 768 and 1440 pixels in light and dark themes. Screenshots inspected.
- Node and Vercel production builds passed; Vercel cron output retains 300 seconds.
  The Vercel build used the web build script directly with `VERCEL=1`, because
  setting that variable before pnpm changes pnpm's local virtual-store defaults.
- Standalone `pnpm deploy --prod --legacy` package starts successfully and serves
  pages, static assets and fallback jobs. Private redirects/APIs fail closed.
  Production Chrome smoke passed hydration, themes, search and keyboard dialogs
  with no JavaScript errors.
- Fresh whole-branch review found three material issues: patch copying in Docker,
  loading state after canceled filters, and auth outages affecting public layout.
  All fixed; cancellation and auth behavior have passing regression coverage.
- Validation ran on Node 24.17 (the available version, meeting >=22.13).
  Docker is unavailable here; live Google authorization and hosted deployments
  remain operational checks. No production database or external account was used.
