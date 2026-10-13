# Execution ledger — plan: docs/superpowers/plans/2026-10-14-employer-discovery.md

Ruling: Native execution in the current checkout on `feat/employer-discovery` — the user repeatedly requested implementation here; a separate branch avoids changes on main and retains installed dependencies. Cost if wrong: filesystem changes share the user's checkout until the branch is switched.

Pre-flight: registry -> budget -> safe feed verification -> discovery -> routes/worker -> public summary interfaces reviewed. Search reservations own short transactions and never use the refresh transaction. Tests use isolated PGlite fixtures with serialized pool clients.

Ruling: Final review uses a fresh agent as required by executing-plans; no implementation tasks are delegated.

Tasks 1–4: Registry, durable quota reservations, board verification, and discovery orchestration implemented. RED: new modules absent; GREEN: 11 new core tests pass, plus existing source tests. Baseline: 56/56 tests passed. PostgreSQL concurrency invariants use a transaction advisory lock; PGlite fixtures serialize its single backend while issuing concurrent reservations.

Ruling: Candidate verification requires a recognized official employer identity and application URLs attributed to that same ATS board. Custom application hosts remain pending — avoids registering unrelated search leads. Cost if wrong: some legitimate employers require a future verification adapter.
