# Publishing ChatGPT research into frontlanejobs

The writer is `POST https://YOUR-DOMAIN/api/ingest/jobs`. Configure bearer authentication with INGEST_TOKEN in a supported connector or runner's secure credentials. The deployment must have the same token. Do not put it in a scheduled prompt. ChatGPT cannot push into an arbitrary deployment without that authenticated connection.

A research batch must include source `research:chatgpt`, a unique runId (for example `research-2026-10-12-am`), `completeSnapshot: false`, and jobs. Schema is in packages/core/src/ingestion.mjs. Each job needs title, company, location, mode, type, salary, tags, experience, summary, caveat, HTTPS application URL, ISO checked time, posted ISO time or null, eligibility and degree. Requisition IDs are optional but should be included when available. Discovery dates are assigned by the server and preserved on updates. Budget currency and units belong in salary for freelance entries; never convert annual salary targets into project budgets.

Research instructions for an authenticated recurring runner:

> Find newly available frontend employment and freelance/part-time/contract opportunities for engineers in India. Prioritize product companies and React, Next.js, TypeScript and React Native; use free official careers/ATS sources and specific public client projects. Verify location and country restrictions, salary or budget, source URL and continued availability. Do not fabricate posting dates. Publish up to 100 verified records under research:chatgpt; keep completeSnapshot false. Use the same runId and identical payload when retrying a failed publication. Read the receipt and public /api/jobs after publication. Do not access user profiles or trackers or submit applications. If publication access is unavailable, report the blocker instead of claiming the app was updated.

The run receipt confirms accepted count, closed count and completion time. Repeating identical source/runId data returns the stored receipt; changing its payload returns HTTP 409. Jobs are deduplicated by source and requisition ID or canonical URL. To close verified unavailable research entries, include their URLs in closedUrls with the same research source. A research batch never replaces an entire employer feed.

Until authenticated connection setup is complete, export researched JSON and use `pnpm jobs:publish batch.json`. Twice-daily employer ingestion remains available through the included external worker.
