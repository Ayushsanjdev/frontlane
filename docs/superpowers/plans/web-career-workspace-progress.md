# Implementation ledger — web career workspace

Plan: `2026-10-14-web-career-workspace.md`; design: `2026-10-14-web-career-workspace-design.md`.

- User approved design, both daily digest modes, implementation plan, and execution. Web only.
- Workspace: current user checkout. Preserve existing generated next-env.d.ts changes; no commits, production writes, or live email sends.
- Execution: inline, following the user's sequential build request. Optional shared contracts remain backward compatible.
- Pre-flight interfaces: enrichment → search/matching; first-publication events → alerts/digests; tracker revision/history → workspace; normalized searches → saved searches; matching → matching digest. No conflicts found.
- Baseline test run in progress; output `/tmp/frontlane-baseline-tests.log`.
- Tasks 1–8: complete locally; see final verification below.
- Baseline: 103/103 passed.
- Data enrichment, first-publication deduplication, tracker ownership/revision/history, preference parsing, multi-stack filtering, and recommendation tests passing. Intermediate suite: 113/113 passed; shared web/mobile typecheck passed before email additions.
- Public board, role panel, company directory, public compare, profile/preferences, tracker Today/table/board/details, private offer comparison, inbox and alert controls implemented.
- Ruling: retain active as public-selection compatibility; source_available separately reports employer availability. Full snapshots are accepted atomically with a 2,000-eligible-role cap; oversized remote batches fail safely rather than reconcile partial data. The established 100-selected-job batch limit remains.
- Ruling: per-delivery unsubscribe tokens are independently generated and hashed, so old emails remain usable within the same subscription generation without storing a recoverable subscription-wide token.
- Ruling: use the current checkout, as explicitly approved for sequential local implementation; do not create commits or move the user's changes.
- Email queue tests initially exposed a test assuming delivery claim ordering among same-timestamp rows. Fixed the fixture to select by recipient rather than random UUID order; no production delivery ordering is promised.
- Email workflow, both modes, token unsubscribe, durable outbox, provider transport, verified-recipient subscription and signed webhook in progress. Local tests use fake recipients and injected transports only.
- Independent read-only review identified six Important issues (no Critical). Fixed explicit saved-search request DTOs, actual For you filter application, confirmed arrangement filtering, current availability in tracker/detail responses, independent history records for simultaneous changes, and recipient-bound unsubscribe validity across mode changes. Regression RED evidence: `/tmp/frontlane-review-red.log`; GREEN: 22/22 in `/tmp/frontlane-review-green.log`.
- Ruling: already delivered unsubscribe links remain valid while the verified recipient is unchanged. Generation still cancels obsolete queued payloads; recipient changes invalidate old recipient links. This supersedes the initial design's mode-change token invalidation.
- Full suite before review fixes: 123/123 passed. Production build passed. A concurrently launched typecheck collided with Next build replacing generated type files; rerun sequentially after the build instead of changing application code.
- Manual preview uses disposable in-memory/authentication fixtures with a dummy database target on localhost:3100. Existing user dev server on port 3000 remains untouched.
- Tasks 1–8 implemented. Local-only delivery; migrations/configuration/schedules have not been applied to production.
- Focused follow-up review confirmed all six fixes with no new Critical/Important issues; reviewer's 9 targeted tests passed.
- Additional browser checks fixed hidden internal filter chips, a native saved-search prompt replaced by a Radix form, empty legacy preparation checklists, tablet header overflow, and availability disappearing after quick updates. Follow-up completion is now explicit, so merely clearing a date does not inflate completion metrics.
- Browser fixture checks passed: personalized query empty state; verified Applied transition; persisted preparation answer/checklist; saved search create/pause/enable; no horizontal overflow at 360, 768, and 1440px; both themes. Screenshots saved under docs/screenshots. Fixture-only invalid requisitionId was corrected in temporary preview data, not production validation.
- Final full suite: 127/127 passed. Production build passed before the final contrast-only CSS adjustment; rebuilding the stylesheet, followed by sequential typecheck. git diff --check passed.
- Matching digests require a supported match reason; no known match means no matching email. Curated media consists of four verified official icon assets; missing logos use initials, and team photos/company facts are not invented.
- Final verification: 128/128 tests passed, pnpm build passed, sequential pnpm typecheck passed (web and unchanged mobile shared-contract consumers), and git diff --check passed.
- A final regression reproduced duplicate canonical URLs causing a complete employer snapshot to fail persistence. Adapter snapshots now deduplicate canonical URLs before publication and reject contradictory requisition identities. The full suite includes this case.
- Saved-search creation/pause/enable and preparation persistence were verified in the authenticated disposable web preview. Header overflow measured false at 360/768/1440px. Browser viewport override restored.
- Work remains uncommitted in the user's checkout. No production migration/deployment/scheduler change, OAuth sign-in verification, or real email delivery was performed. Production activation requirements are in docs/EMAIL-DIGESTS.md; screenshots use sample data.

- Final post-snapshot-fix verification: 128/128 tests, production build, sequential shared typecheck, and git diff --check all passed. Disposable preview stopped; user dev server untouched.
- Ruling: private contacts/interviews/documents/offers are bounded structured records in the versioned application workspace, updated atomically through owner-scoped PATCH rather than separate child CRUD routes. This preserves privacy and legacy payload compatibility while delivering the same web capabilities.
