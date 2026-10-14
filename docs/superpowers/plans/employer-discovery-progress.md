# Execution ledger — plan: docs/superpowers/plans/2026-10-14-employer-discovery.md

Ruling: Native execution in the current checkout on `feat/employer-discovery` — the user repeatedly requested implementation here; a separate branch avoids changes on main and retains installed dependencies. Cost if wrong: filesystem changes share the user's checkout until the branch is switched.

Pre-flight: registry -> budget -> safe feed verification -> discovery -> routes/worker -> public summary interfaces reviewed. Search reservations own short transactions and never use the refresh transaction. Tests use isolated PGlite fixtures with serialized pool clients.

Ruling: Final review uses a fresh agent as required by executing-plans; no implementation tasks are delegated.

Tasks 1–4: Registry, durable quota reservations, board verification, and discovery orchestration implemented. RED: new modules absent; GREEN: 11 new core tests pass, plus existing source tests. Baseline: 56/56 tests passed. PostgreSQL concurrency invariants use a transaction advisory lock; PGlite fixtures serialize its single backend while issuing concurrent reservations.

Ruling: Candidate verification requires a recognized official employer identity and application URLs attributed to that same ATS board. Custom application hosts remain pending — avoids registering unrelated search leads. Cost if wrong: some legitimate employers require a future verification adapter.

Tasks 5–7: Registry-backed cron and worker refresh, protected discovery route/command, public aggregate status, and configuration documentation implemented. Initial full verification: 71/71 tests, typecheck, and production build passed. Browser: empty status view inspected at desktop and 390px mobile widths in light/dark themes; no mobile overflow.

Final review: fresh reviewer found three Important issues. Each was reproduced RED before correction: real Lever plain titles, aliasing between polling and selection, and unbounded database work. The server's omitted deferred count was regraded Important against the explicit reporting requirement and reproduced RED. A further persistence regression proved candidate writes were per-result (four writes for two duplicate-result pages); batch persistence reduces this to one statement per page.

Ruling: Selection now uses persistent `last_selected_at` priority instead of a UTC-day array offset — the original two cycles could indefinitely exclude employers. Cost if wrong: selection distribution changes, while the 50-job target and per-source snapshot contract stay the same.

Ruling: Discovery gives PostgreSQL queries explicit timeout budgets and reserves five seconds beyond the 20-second work deadline for receipts and lease release; seeding and result persistence are batched. Cost if wrong: slow database operations return partial/unavailable rather than completing all scheduled work.

Ruling on declined review areas: production deployment, scheduling, billing, and real PostgreSQL crash recovery remain activation checks; local fixtures cannot establish them. Responsive/themes were inspected separately. Existing worker-versus-cron concurrency and feed JSON sizes were not expanded by this change and remain outside this feature's verified scope; no unrelated redesign was made.

Tasks 1–8: complete. Final verification: `pnpm test` passed 76/76; `pnpm typecheck` passed; `pnpm build` passed with both new protected routes. `git diff --check` passed. The generated Next type-reference paths were restored after building to avoid an unrelated generated-file diff; typecheck passed afterward. Desktop and mobile, empty and populated discovery statuses, light/dark themes inspected; no horizontal overflow. The populated SSR test also verifies raw candidate evidence and keys are absent.

Final: fixed all Important findings with RED→GREEN regression tests, then green full suite. Deferred minors: none. Production migration, deployment, key configuration, scheduler activation, and live Brave verification remain operator activation steps documented in `docs/EMPLOYER-DISCOVERY.md`.
