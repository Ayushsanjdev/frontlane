# Explore Collections Implementation Plan

**Goal:** Deliver the approved Explore hub, company collections, verified funding and Fresher Special.
**Architecture:** Database-owned curated catalog; core-owned identity, eligibility and SQL predicates; existing web board with fixed collection context.
**Spec:** The approved conversation plan, captured in `docs/superpowers/specs/2026-10-15-explore-collections.md`.

## Constraints and decisions
- Preserve pre-existing uncommitted Remote Jobs changes; implement in this checkout because those changes are required inputs.
- No new environment variables, credentials, providers or paid services. Local and production use the same catalog and refresh command.
- Company classifications are descriptive editorial groups with official evidence, never quality rankings.
- No invented jobs or funding. Unsupported employers have careers links and accept verified research through the existing publisher.

## Tasks
- [x] Catalog and eligibility: test exact identity, funding boundaries, experience conflicts; add catalog, core filters and career-stage validation.
- [x] Query and publication integration: test PGlite/fallback parity and alerts; wire ingestion, public publication, recommendation SQL and saved searches.
- [x] Discovery UI: add hub, collection and catalog profile pages; reuse board with persistent route context; link navigation and homepage.
- [x] Sourcing and operations: verify additional supported boards, seed registry through existing refresh; document local/production maintenance.
- [x] Verification: full tests, typecheck, production build, browser responsive/theme/navigation checks and final review.

## Review focus
Funding cutoffs use UTC calendar dates and clamp leap-day subtraction; future announcements are rejected. Known feed identity wins over ambiguous names. Clear filters and remote toggling must retain collection context. Senior requirements override internship/graduate words. Catalog companies must remain visible with no jobs or unavailable database.

## Progress
Completed in the existing checkout, preserving the pre-existing Remote Jobs work. Baseline: 146 tests passed. Final: 159 tests passed, `pnpm typecheck` passed, `pnpm build` passed, and `git diff --check` passed.

Independent review found no remaining important issues after fixes. Ruling: a role advertising 0–3 or 1–5 years accepts applicants meeting the confirmed minimum of zero or one; upper bounds alone do not override that minimum. Higher required minima, seniority and explicit fresher exclusions still exclude the role. This interpretation follows the approved plan and is documented in EXPLORE.md.

Browser verification: all collection pages and company directory return 200; checked company profiles, filtering/clear/remote context, role dialogs, browser history, keyboard focus, 390px mobile and 1440px desktop, light/dark themes and horizontal overflow. No browser console errors observed during checks. Screenshots are in `/tmp/frontlane-explore-final-desktop-light.png`, `/tmp/frontlane-explore-final-desktop-dark.png` and `/tmp/frontlane-freshers-mobile-dark.png`.

No new environment variables, database migration, credentials or provider subscription were needed. Existing `.env.local` values were preserved; `.env.example` and `docs/EXPLORE.md` explain both local and production setup. No deployment, remote refresh publication or git commit was performed.
