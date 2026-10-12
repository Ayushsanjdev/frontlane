# Frontlane SvelteKit migration and blue/slate redesign

Status: approved and implemented on `feat/sveltekit-blue-slate`.

## Intent and success criteria

The user requested a new branch, a migration to Svelte and suitable supporting
tools, and a redesign of the whole UI that removes the current green identity.
The user selected a clean, calm, professional blue and slate visual direction.
Work is isolated on `feat/sveltekit-blue-slate`.

Success means the web workspace runs on SvelteKit, every existing user flow and
API remains available, and all pages share a coherent blue/slate design in light,
dark, and system themes. Existing PostgreSQL data and user ownership must survive
the migration. The worker and shared packages retain their existing contracts.

## Approaches considered

1. **Replace `apps/web` with SvelteKit (recommended).** One application, one
   runtime, and one dependency stack. Requires porting routing, authentication,
   UI components, launch tests, and deployment together.
2. **Add a second Svelte frontend alongside Next.js.** Enables gradual page
   migration but introduces two servers, duplicate UI, and authentication
   coordination. This adds operational work without serving the requested end
   state.
3. **Only restyle the existing React app.** Smaller effort, but does not fulfill
   the requested framework migration.

## Tooling

- Svelte 5 and a mutually compatible stable SvelteKit/Vite toolchain, with strict
  TypeScript and generated route types. Confirm published package versions and
  peer dependency compatibility when installing; do not adopt prereleases just
  to obtain a higher version number.
- Tailwind CSS 4 through its Vite integration, with semantic CSS design tokens.
  Reuse `clsx` and `tailwind-merge` where useful.
- Auth.js for SvelteKit with the existing Google provider and JWT session model.
- Lucide's Svelte icons. Build small shared Svelte button/form components and use
  native dialogs with explicit focus management, Escape dismissal, accessible
  titles, and return focus. Remove the React-only UI dependencies after parity.
- `svelte-check` plus TypeScript for checking components and server code. Keep
  Node's test runner and PGlite for current integration tests; use Playwright
  for focused browser validation of navigation, filters, dialogs, and themes.
- A Node adapter for local production and Docker. Select a Vercel adapter for
  Vercel builds, keeping platform selection explicit and documenting it.
- Keep pnpm workspaces and `pnpm-lock.yaml` as the only lockfile. Preserve the
  root command names and the root `.env.local` loading behavior.

Use the configuration format supported by the installed SvelteKit version;
current documentation describes configuration changes between major versions.

## Application boundaries

`apps/web/src/routes` owns SvelteKit layouts, pages, server loads, actions, and
`+server.ts` endpoints. `src/lib/components` owns Svelte UI primitives and feature
components. `src/lib/server` owns authentication, session checks, database-backed
page retrieval, and API helpers. Shared public types stay in `src/lib/types.ts`.
Static assets move to `apps/web/static`.

Use SvelteKit's `$lib` alias inside the web workspace and preserve workspace
package exports for `@frontlane/core/*` and `@frontlane/database/*`. Database
imports must remain in server-only modules. Do not serialize authentication
secrets, database connection strings, or another user's records into page data.

The root server layout returns only the current user's public display identity.
Private page loads require authentication. Request-scoped session helpers replace
the current global `auth()` helper; handlers receive SvelteKit request events.

## Page parity and presentation

| URL | Behavior to preserve | Design change |
| --- | --- | --- |
| `/` | Live featured jobs, clearly labeled fallback, links to board and tracker | Large left-aligned headline and a straight, readable opportunity preview; remove decorative orbits and floating code |
| `/jobs` | Search, type/mode/stack filters, sorting, pagination, job deep links, saving | Clear search header, compact filter rail on desktop, mobile filter disclosure, readable result cards |
| `/tracker` | Private list, stage filters, search, manual entries, editing, deletion confirmation, export | Practical workspace with stage counts, a calm table on desktop and compact rows on mobile |
| `/account` | Private profile retrieval, editing, saving, clipboard copy | Grouped form fields, clear labels and save feedback |
| `/signin` | Google sign-in and safe return destination | Focused sign-in panel using the shared layout and theme |
| `/updates` | Feed status, selected counts, check times | Legible status table and explanatory availability text |
| `/about` | Existing product and source explanation | Consistent prose typography and restrained spacing |

Initial job data is server-loaded. Interactive requests preserve debouncing and
cancellation, reset pagination when filters change, and expose loading/error
states. An unsuccessful refresh must not replace visible results with fabricated
data. A missing deep-linked job displays a clear unavailable message.

Tracker/profile mutations continue using the existing JSON APIs. Preserve all
stage requirements, follow-up dates, notes, answers, evidence, duplicate-job
handling, and account ownership. Keep profile retrieval failures distinct from an
empty profile so an outage cannot overwrite saved details.

## Visual system

| Token | Light theme | Dark theme |
| --- | --- | --- |
| Canvas | `#F5F7FB` | `#101827` |
| Surface | `#FFFFFF` | `#192438` |
| Text | `#17243A` | `#E7EEF8` |
| Secondary text | `#52627A` | `#A9B8CD` |
| Primary action | `#2457D6` | `#91B4FF` |
| Border | `#D8E1EF` | `#33435C` |

Use white text on light-theme primary buttons and dark slate text on dark-theme
primary buttons. Validate contrast in actual components. Use blue/violet for
positive status, amber for caution, and red for destructive actions; communicate
status through words and icons as well as color. Remove green and mint tints from
branding, backgrounds, badges, selection colors, illustrations, and the favicon.

Use a locally hosted variable sans-serif such as Manrope, subject to its license,
for headings and body copy, with differentiated weight and scale. Body text is
at least 16px where practical, supporting copy at least 14px, and headings use a
responsive scale. Keep reading lines near 65 characters.

The distinctive element is the typography and career workspace preview. Keep
supporting surfaces quiet: modest radii, restrained shadows, useful dividers,
and consistent spacing. Avoid repeating identical cards for every content type.
Make important actions visibly clickable and provide generous touch targets.

Persist the existing `frontlane-theme` preference, respect system changes, and
apply the theme before first paint. Both themes must cover dialogs, native form
controls, tables, empty states, and error states. Respect reduced motion and
retain the skip link and visible keyboard focus.

## API and authentication compatibility

Preserve `/api/jobs`, `/api/health`, `/api/profile`, `/api/tracker`, `/api/viewers`,
`/api/ingest/jobs`, `/api/ingest/status`, and `/api/cron/jobs`, including methods,
response schemas, status codes, caching, payload bounds, and origin checks.

Configure Auth.js at `/api/auth` to retain the documented Google callback URL
`/api/auth/callback/google`. Keep verified Google email checks and identity keys
`google:<providerAccountId>` so existing profiles and applications stay attached
to the same users. Existing browser sessions may require signing in again because
framework integrations can use different cookie conventions; persisted user data
must remain accessible after sign-in.

Anonymous public browsing must work without configured authentication secrets.
Private pages redirect to the safe sign-in destination and private APIs return
401. Cross-origin private writes fail before database access. Preserve bearer
token authorization, replay conflicts, transaction/savepoint behavior, refresh
locking, source isolation, and viewer-cookie/counting semantics.

## Deployment and documentation

Update the web scripts, TypeScript configuration, ignore patterns, Dockerfile,
Vercel configuration, README, and scoped repository guidelines for SvelteKit.
Remove obsolete Next.js configuration, React files, and generated declarations
after their replacements are validated. Preserve third-party license files.

Docker continues to run as a non-root user and includes the Node-adapter output,
required workspace packages, runtime dependencies, and database seed assets.
Configure the canonical origin/proxy handling supported by the selected adapter
so OAuth and CSRF checks agree with the deployed origin. Keep the cron path and
schedule; translate the execution-duration setting to the Vercel adapter's
supported route configuration.

No database schema migration is planned. Existing environment variable names and
root operational commands should continue working; document any adapter-specific
deployment variables. Verify production startup with both configured and absent
root local env files without printing secret values.

## Validation and acceptance

The unchanged baseline has 54 passing tests. Update framework-specific test
loaders and launcher assertions instead of dropping their behavioral coverage.
Add focused checks for request-scoped identity, safe redirects, retained Google
identity keys, and Svelte endpoint event handling.

Run `pnpm install --frozen-lockfile` after generating the new lockfile, then
`pnpm typecheck`, `pnpm test`, and `pnpm build`. Start the production Node output
and verify public routes, static assets, API responses, and anonymous private-page
redirects. Check Docker build/start when Docker is available.

Inspect every page at mobile, tablet, and desktop sizes in both themes. Exercise
filters, deep-linked details, pagination, modal keyboard behavior, theme
persistence, and empty/error states. Capture representative home, board, and
tracker screenshots for review. Test authenticated behavior with fixtures; report
live Google OAuth as unverified unless an actual configured flow is exercised.

Completion requires a functioning SvelteKit app with no active React/Next runtime,
the chosen design across all pages, passing required checks, and explicit reporting
of any environment-dependent validation that could not be performed.

## Primary documentation checked

- [SvelteKit project structure](https://svelte.dev/docs/kit/project-structure)
- [SvelteKit Node adapter](https://svelte.dev/docs/kit/adapter-node)
- [Auth.js SvelteKit integration](https://authjs.dev/reference/sveltekit)
- [Tailwind CSS Vite integration](https://tailwindcss.com/docs/installation/using-vite)
