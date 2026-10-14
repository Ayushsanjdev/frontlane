# Public job posting

The jobs page's **Add a job** button opens a public listing form. Any signed-in Google user can publish an eligible frontend role in India or explicitly worldwide remote work. Signed-out visitors are sent to sign-in and return to the posting form.

Run `pnpm db:migrate` before deploying this version. `003-public-job-posts.sql` adds private publisher attribution and retry receipts in `job_publications`, plus a canonical-URL lookup index. Publisher IDs and submission receipts are not included in public job payloads.

Publishing is a same-origin, authenticated `POST /api/jobs`. The server validates all fields and HTTPS application links, supplies source/date metadata, enforces ten publications per account per UTC day, and commits the public job and publication receipt together. Clients cannot provide source identifiers or verification dates. A repeated unchanged submission UUID returns its original job; conflicting requests and duplicate links return HTTP 409. Database failures do not leave half-published listings.

Posts are labeled **Community listing** and show a community submission date. They do not create employer verification checks or invent employer posting dates. Active employer-feed records take display priority when an application link also has a community post; source records remain independently owned. Publication does not create or modify private tracker entries.

After publishing, the board clears filters, reloads fresh results in newest order, and opens the published job. Ordinary failed network requests can be retried without creating a second listing. Form drafts stay in page memory; signing in again after an expired session or navigating away does not preserve an unfinished draft.

Validated with core/route integration tests, a fresh read-only review, desktop/mobile jobs-page checks, and a separate local signed-in UI fixture using fabricated API responses. No real public jobs were published during browser verification, and no production migration or deployment was performed.
