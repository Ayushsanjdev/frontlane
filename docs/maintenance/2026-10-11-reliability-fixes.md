# Reliability and cleanup fixes

Scope: fix the issues identified in the repository review, preserving the existing routes, authentication, PostgreSQL storage, and visual design.

1. Load profiles on the authenticated server page. If retrieval fails, render a retry message without the editable form. Keep the API for other clients.
2. Validate every tracker field with a strict schema, including dates and application evidence. Keep writes and deletes scoped to the signed-in user.
3. Share job retrieval between the homepage and API. Include tags in search, distinguish relevance from newest order, and retrieve details by ID independently of pagination. Consolidate curated jobs into one dataset.
4. Keep the cron transaction and advisory lock on one connection. Use ingestion savepoints on that connection so failed sources can roll back independently. Roll back and release on all failures.
5. Remove unreachable UI components, their exclusive dependencies, unused assets, and unused imports/helpers. Preserve active UI primitives and vendor licenses.
6. Add behavioral regression tests for validation, job lookup/search, profile retrieval failure, and connection cleanup. Run typechecking, tests, and production build when dependencies are available.

Constraints: Node.js 22.13+, strict TypeScript, existing route URLs, no credential changes, no commits or pushes, and no modification to AGENTS.md.
