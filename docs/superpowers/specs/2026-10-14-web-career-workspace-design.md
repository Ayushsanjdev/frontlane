# Web career workspace

## Intent and success

Build the full discovery-to-application roadmap for frontend engineers in India. Help visitors assess opportunities quickly and help members find relevant roles, prepare applications, and complete their next action. The user selected a balanced journey and authorized the entire roadmap, implemented sequentially. The latest constraint is **web only**: do not change the native mobile UI.

Success means useful job cards without fabricated facts, reproducible searches, explainable recommendations, and a private tracker that surfaces pending work. Verify behavior locally; do not claim that production migrations, OAuth, notifications, or deployment have been exercised unless actually tested.

## Constraints and defaults

- Use Node.js 22.13+, pinned pnpm, Next.js App Router, strict TypeScript, existing UI primitives, PostgreSQL, and node:test/PGlite. Keep pnpm-lock.yaml as the only lockfile.
- Preserve the existing visual identity and light/dark themes. Reduce wasted vertical space on utility pages; keep the marketing home page intact except for links to new features.
- Maintain core → database dependency direction. Shared contracts and validation may gain optional fields; existing mobile requests and responses must remain valid. Do not edit apps/mobile.
- Keep browsing public and member information private. Reuse authenticated identity, same-origin write checks, bounded request bodies, and no-store private responses.
- Add no paid AI, scraping, or image service dependency. Provide persistent in-app notifications and an opt-in daily email digest using Resend's HTTPS API. No automatic application submission or outbound recruiter messages.
- Employer-provided facts and explicitly labeled extraction are distinct. Unknown salary, experience, benefits, working hours, or company facts remain unknown. Do not display hiring-probability percentages.
- Changes are local until deployment is explicitly requested. Include idempotent migrations and configuration/documentation changes; do not migrate production as part of implementation.

## Delivery order

1. Job data enrichment and availability semantics.
2. Board, search, role details, and company pages.
3. Tracker Today view and quick actions.
4. Tracker board, history, contacts, interviews, and documents.
5. Structured preferences, personalized recommendations, and feedback.
6. Saved searches, in-app alerts, daily email digests, comparison, preparation, offer comparison, and useful progress measurements.

Each increment must leave the app usable and pass its relevant tests before the next increment. Run the complete typecheck, tests, and production build at the end. Record implementation and verification progress in a separate plan after design review.

## 1. Job data and company information

### Additive job enrichment

Keep the existing Job fields and their meanings for compatibility. Add optional enrichment containing:

- Full cleaned description, bounded to 40,000 characters. Keep the current short summary for list rendering.
- Structured compensation: minimum/maximum, currency, annual/monthly/hourly period, and source text. Populate only from explicit source values or unambiguous description text. Do not convert currencies or infer CTC/base/equity equivalence.
- Seniority and minimum/maximum years when explicitly supported; identify extraction as such. Conflicting values stay unknown with source text available in details.
- Required and preferred technologies separately when source headings support that distinction. Otherwise keep neutral technology tags. Match tokens rather than substrings so React Native does not automatically imply React web.
- Employer-supported benefits and timezone/working-hour requirements. Empty arrays or absent values do not imply no benefits or no restrictions.
- Explicit workplace arrangement when supplied. Preserve the legacy mode field, but use an optional known/unknown arrangement indicator in the web UX so missing remote evidence is not advertised as confirmed onsite work.

Reuse a common enrichment schema for ingestion and tracker snapshots. Extend trusted adapter normalization; retain old manual/community publication input compatibility. Render descriptions as text/structured paragraphs, never unsanitized employer HTML.

### Availability and daily selection

Separate being selected for the public daily board from being present in an employer feed. Keep the existing daily target and source-diverse selection.

- Add selection state distinct from active availability. Persist all eligible jobs observed in a successful employer feed, while selecting the daily board separately. Chunk ingestion when the eligible source snapshot exceeds the existing 100-item batch limit; reconcile closures only after the complete source succeeds.
- A selected listing is available in the public board; an unselected job can still be available in source and reachable from a saved tracker snapshot.
- Mark a job confirmed closed only when absent from a successful complete employer snapshot or explicitly closed by an authorized source. Failed/partial snapshots preserve prior availability.
- Legacy inactive records begin as unknown availability, not confirmed closed. Do not reinterpret old rotation removals as employer closures.
- Keep employer posting, first discovery, and last check distinct. A fresh check never creates a new-job alert for an existing listing.
- Saving a role preserves the member's job snapshot even after a listing becomes unavailable. Tracker/detail UI reports available, closed, or unknown availability without deleting notes.

### Company identity and media

Add stable company IDs keyed by employer source identity, with an explicit curated mapping for multi-provider employers. Never merge employers solely by fuzzy name matching or infer a company domain from an ATS URL.

Create company profiles with name, official website, concise attributed description, available roles, and optional industry, size, product image, team image, and image captions/source URLs. Populate metadata from approved official source information or checked-in curated records. Unknown values are omitted.

Use locally stored official company logos where verified and available, with initials as the universal fallback. Images have fixed dimensions, lazy loading outside the first viewport, accessible alternatives, and failure fallbacks. Include authentic, attributed media only where available; no generated team/office photos. Media is optional and lives in company/detail views rather than bloating job cards.

## 2. Board, search, and role details

- Compact page heading and search area so opportunities appear sooner. Job cards lead with logo, company, title, location/eligibility, arrangement, employment type, seniority when known, up to four relevant technologies, compensation when disclosed, and check status.
- Clearly separate employer-feed listings, researched listings, and community listings. A checked timestamp does not imply employer endorsement or verified salary.
- Add direct company links, save/open-tracker actions, and a compare checkbox. Keep one clear role-detail action and avoid nested interactive elements.
- Search supports query, employment type, multi-select stacks including Angular/Vue/Svelte, arrangement, city, seniority, disclosed-compensation-only, and normalized compensation minimum. Compensation minimum requires a currency and period selection; compare only listings in that unit and make unknown handling explicit.
- Define multi-stack filtering as ANY selected stack, matching the technology vocabulary. Keep legacy single-stack API requests valid.
- Serialize filters, sort, and page in the URL. Server-render the same initial results. Refresh, copy/paste, browser back/forward, and role-detail close restore the search context. Filter changes reset page to one.
- Provide removable active-filter chips, Clear all, accessible loading feedback, an explicit retry action, and empty-state suggestions. Failed refreshes label retained results as stale rather than presenting them as the new search's results.
- Desktop uses a results list with a detail panel; narrow layouts use a full-height detail sheet with scrollable content and a sticky Apply/Save action area. Use the existing dialog primitives for focus management. Preserve deep links through the existing job query parameter.
- Rename generic Recommended to Relevant in public browsing. Personalized ordering is called For you and appears only for members with matching preferences. Recently discovered retains its existing meaning.
- Use employer diversity as a secondary ordering rule within comparable relevance tiers; do not let diversity outrank an explicitly better match or change chronological sort.

## 3. Tracker daily workflow

- Add Today, Applications, and Archived views. Today shows overdue follow-ups, due-today actions, and upcoming scheduled interviews ordered by the member's configured timezone (default Asia/Kolkata).
- Keep follow-up dates visible on mobile web. Distinguish overdue/today/upcoming with text and icons, not color alone.
- Add quick reschedule, complete follow-up, archive/unarchive, and stage-change actions. Successful updates remain visible; failed mutations retain previous state and offer retry.
- Applied, Interview, and Offer continue to require application date and the member's confirmation. Offer a compact confirmation dialog, prefilled with today's date, instead of forcing the entire editor. An external Apply click does not mark Applied.
- Add server-side PATCH for targeted tracker updates scoped to the authenticated member. Preserve idempotent save behavior. Store updates and history transactionally. Use a revision/version check for web updates and return a conflict that prompts refresh rather than silently overwriting concurrent edits.
- Legacy POST continues to accept the existing application shape and preserves extended metadata/history when absent from a legacy client request. Reject changing another member's application by ID.
- Export includes the active and archived collection, existing columns, and the new private fields; retain spreadsheet-formula escaping.

## 4. Rich application workspace

- Applications has Table and Board toggles with a locally remembered preference. Board columns use the existing seven stages; on small screens use stage tabs/columns without requiring drag interactions. Stage menus are fully keyboard accessible; drag-and-drop is not required for this release.
- Add member priority (high/normal/low), next-action text, and archive state. Archiving is separate from employer availability and application stage.
- Replace the monolithic edit form with an application detail workspace containing Overview, Activity, Interviews, Contacts, and Documents sections.
- Record a server-generated chronological history of stage changes, follow-up completion, archive changes, and interviews. Members can add their own notes; user-editable notes cannot rewrite historical stage events.
- Contacts are per-application private records with name, role, email, LinkedIn/website link, and notes. No email sends or account imports.
- Interviews have round/title, date/time/timezone, meeting link, preparation notes, outcome, and completion/cancellation state. Calendar export downloads a valid .ics event using UTC timestamps and escaped text, with no calendar integration permission needed.
- Documents retain links to member-controlled resumes/cover letters/portfolios, a human-readable version label, and the date used. No file upload or automatic access to resume content.
- Introduce cursor pagination for the tracker so old applications remain accessible beyond the current 1,000-row cap. Keep the existing array GET response for legacy callers and add a paginated response only when explicitly requested. Export fetches all pages.

## 5. Preferences and recommendations

- Keep the existing profile fields for application copying. Add optional structured matching preferences: target roles, skill list, experience years, target cities, work arrangements, employment types, and compensation preference with currency/period. Preference editing does not require importing or parsing a resume.
- A short onboarding form captures matching preferences with Skip available. Existing accounts can use their current profile skills/preference as editable suggestions; do not silently turn free text into hard eligibility rules.
- Recommendations are deterministic and explainable. Hard filters apply only to explicit user restrictions and known job facts. Unknown requirements stay visible with a warning unless the user explicitly asks for known-only results.
- Rank known skill overlap first, role/seniority alignment next, then work/location preferences. Use recency as a tie-breaker and employer diversity within equal relevance tiers. Provide evidence-based reasons and missing-information notes, not a numerical hiring likelihood.
- Hide job, hide company, and reset hidden results are member-scoped persistent feedback. Hidden results affect For you, not public searches unless the member explicitly enables hide filtering.
- Serve personalized data from an authenticated no-store endpoint; do not add private match reasons or hidden feedback to public cached job responses.

## 6. Alerts, comparisons, preparation, and progress

### Saved searches and alerts

- Members name and save the current search, manage up to 20 searches, and enable/disable in-app alerts independently for each.
- Persist normalized search criteria, enabled state, creation time, and the last evaluated boundary. On save, initialize the boundary to the current time so the existing catalogue does not create an alert flood.
- An authenticated notifications endpoint evaluates enabled searches against newly discovered selected jobs and persists deduplicated notifications keyed by member/search/job. Use a transaction and a unique constraint so retries/concurrent tabs cannot duplicate alerts.
- Exclude jobs hidden by that member and suppress repeated refreshes, company-source duplicates, and discovery-date backfills. Evaluate from durable ingestion timestamps rather than browser clocks. Preserve the boundary on database errors.
- Show unread count, notification list, mark-read actions, and direct links restoring saved search context. Evaluate when the member opens the workspace and on visible-tab refresh; describe alerts accurately as in-app, not background email delivery.

### Daily new-jobs inbox digest

The user approved this addition after reviewing the initial design and selected **offer both, with matching jobs as the default**.

- Signed-in members can explicitly subscribe using their verified Google account email. Never accept an arbitrary recipient address from a request body. Subscriptions start disabled; show the opt-in on the board and in account settings.
- Offer Matching jobs and All new jobs modes. Matching is the default; require at least one explicit matching preference before enabling it and direct members without preferences to the short preference setup. Empty preferences must not silently subscribe someone to all jobs.
- Send one consolidated digest per subscribed member per Asia/Kolkata publication day, after a successful daily refresh transaction commits. Include genuinely first-published selected jobs since the previous successful digest boundary, not old jobs with updated checks or roles reselected by rotation. Include community/research jobs newly published before that daily cutoff. First subscription starts at its activation time and does not email the old catalogue.
- Capture publication events durably in the same transaction that first makes a job publicly visible. Deduplicate by canonical application URL across sources, retaining employer display priority. A newly selected role observed earlier in an unselected feed counts on its first public publication; previously published reselected roles do not.
- A partially successful refresh can publish and notify its genuinely new jobs. Total refresh failure or a skipped concurrent refresh does not create a new digest campaign. No new qualifying jobs means no email; record a successful empty evaluation boundary without fabricating a send.
- Digest content includes job title, company, location/arrangement when known, relevant skills, employer compensation when disclosed, and links to role details. Display at most 20 jobs in the email and link to a persisted digest page containing the complete frozen list. Keep matching/hiding criteria consistent with the For you feed and show match reasons only to the recipient.
- Subscriptions, publication events, digest snapshots, and recipient deliveries live in PostgreSQL. Use unique member/publication-day delivery keys, transactional claims, frozen recipient/content/mode, delivery status, attempt count, next-attempt time, and provider message ID. Repeated cron calls, concurrent workers, and worker restarts must reuse the same delivery.
- Use Resend through a replaceable core transport function and ordinary fetch, without adding an SDK. Send HTML and plain text. Include a visible unsubscribe link plus List-Unsubscribe and List-Unsubscribe-Post headers.
- Use a cryptographically random persistent unsubscribe token stored hashed; the raw token is embedded in the frozen delivery payload, which is private and never logged. GET displays a confirmation page without mutating subscription state, protecting against email link scanners. Token-authorized POST unsubscribes without sign-in; RFC one-click POST is supported. Invalid tokens return a generic response and never expose a recipient.
- Claim and queue deliveries after the refresh commit; perform no email network calls while holding the ingestion transaction/lock. Drain only within the remaining refresh time budget. A separately authorized /api/cron/digests route drains outstanding deliveries in bounded batches and resumes via durable queue state; document scheduling it every ten minutes. Existing daily job scheduling stays unchanged.
- Respect provider rate limits, Retry-After, timeouts, and retryable server/network failures. Permanent recipient errors disable/suppress the subscription. Webhook verification is required for bounce/complaint suppression; use Resend's signed webhook scheme and never trust unsigned delivery events.
- Reuse a deterministic provider idempotency key and identical frozen request body on retries. Resend retains keys for 24 hours: ambiguous sends must not be automatically retried after that window; mark them for operator reconciliation. Do not claim exactly-once mailbox delivery or that provider acceptance means delivered. Late unsent digests older than 48 hours expire rather than arriving as an obsolete flood.
- Check subscription/suppression state before every send; unsubscribe cancels pending deliveries. Recipient changes require a new verified web session and a new opt-in, invalidating old recipient/token deliveries. Process queued retry work even on a day with no new jobs.
- Add RESEND_API_KEY, EMAIL_FROM, and RESEND_WEBHOOK_SECRET to .env.example and operational docs. Production delivery requires a verified sending domain and the retry schedule. Missing configuration shows email delivery as unavailable and leaves email subscriptions disabled; browsing, ingestion, and in-app notifications continue normally. Never echo credentials, send live test emails, or provision external resources automatically.
- Test with an injected transport and signed webhook fixtures. Measure queued, accepted, failed, ambiguous, suppressed, and expired counts without logging email addresses or message bodies.

### Job and offer comparison

- Visitors can compare two or three job IDs in a shareable URL. Compare role, location, arrangement, salary with units, seniority, technologies, eligibility, and known benefits. Do not convert currencies or silently compare annual and monthly figures. Missing/closed roles show a clear status.
- Members can compare up to three offers attached to their applications. Keep offer data private and provide separate base, variable, equity text, currency, pay period, start date, location, and decision deadline. Compare monetary values only in identical units; do not calculate a misleading total including unpriced equity.

### Preparation

- Add a per-application checklist for reviewing requirements, choosing a resume link, checking portfolio examples, recording submission, and preparing questions. Completion is private and persists across devices.
- Offer interview preparation prompts grounded in the listing's known technologies and responsibilities, plus a clearly labeled generic frontend preparation checklist. Members write and save their answers. Do not claim AI personalization or manufacture employer interview questions.
- Provide editable follow-up and thank-you text templates for copying, with unknown contact details left blank. Never send messages automatically.

### Useful measurements

- Private progress shows applications submitted, interviews reached, offers received, and follow-ups completed, with a selectable time range. Use activity history for transitions and label incomplete historical coverage on legacy applications.
- Any interview conversion ratio uses distinct confirmed applications as the denominator, an explicit time window, and a minimum-data/insufficient-data state. It is descriptive, not a prediction or a judgement of candidate quality.
- Instrument first-party events for search, detail views, saves, confirmed application transitions, and task completion without notes, contact data, document URLs, or search text. Use the existing visitor identity only for anonymous aggregate counts; retain signed-in workflow counts privately. Document retention and disablement. No external analytics dependency.

## API, persistence, and compatibility

- Add optional enrichment and workspace types to packages/contracts. Keep old Job/Application/Profile shapes accepted by the core validators.
- Add idempotent SQL migrations for company metadata, job selection/availability/publication events, tracker revision/history, saved searches, feedback, notifications, digest subscriptions/snapshots/deliveries, and webhook receipts. Use foreign keys or equivalent member-scoped ownership checks for private child records. Index member/date queries and notification/delivery deduplication keys.
- Public endpoints: existing jobs collection/detail extended with compatible filters and optional enrichment; company list/detail with available jobs; comparison obtains public job details.
- Private endpoints: tracker PATCH and explicit cursor GET, matching preferences/recommendations/feedback, saved-search CRUD, notification read/evaluation, and tracker contacts/interviews/documents/offers. Use resource IDs validated before queries and transactional parent ownership checks for all child mutations.
- The public board remains useful during database outages with visibly labeled curated fallback. Private actions never silently write locally or return fabricated success. Personalized recommendations fail with a retry state instead of leaking into a public cache.
- Document migration order, refresh changes, in-app alert semantics, privacy changes, and any optional curated media attribution. Email sending requires the documented Resend configuration; the remainder requires no new credentials.

## Verification and acceptance

- PGlite tests cover idempotent migrations, complete/partial source snapshots, selection versus closure, replay conflicts, source isolation, and all private resource ownership boundaries.
- Data tests cover explicit/unknown/conflicting salaries and experience, currency/period separation, tokenized technology extraction, safe description rendering, and legacy payload compatibility.
- Search tests cover multi-stack semantics, shared URL round trips, initial server/client consistency, pagination reset, fallback parity, employer diversity, and hidden-result isolation.
- Recommendation tests cover preference changes, cold start, unknown data, explicit restrictions, stable ordering, reasons supported by source facts, and cache separation.
- Tracker tests cover required submission confirmation, atomic history, concurrent revision conflicts, archive separation, follow-up date/timezone boundaries, interview .ics escaping, legacy preservation, and cursor/export completeness.
- Alert tests cover initial boundary, new discovery versus recheck, deduplication, concurrent evaluation, disabled/deleted searches, hidden jobs, failed evaluations, and ownership.
- Digest tests cover opted-in verified recipients, both modes, absent preferences, first-publication events, unchanged/reselected/cross-source roles, empty and failed refreshes, transaction boundaries, concurrent/replayed dispatch, frozen retry payloads, rate limits, ambiguous sends beyond 24 hours, expiry, token hashing, scanner-safe GET, one-click POST, unsubscribe cancellation, signed webhook verification, suppression, and missing configuration. No tests send real email.
- Compare/preparation tests cover missing roles, mismatched money units, private offer access, editable template persistence, and analytics fields excluding private content.
- Run pnpm typecheck, pnpm test, and pnpm build. Manually inspect at 360px, 768px, and desktop in light/dark themes; verify keyboard navigation, visible focus, dialog focus return, readable long titles, broken images, empty/loading/error states, and no horizontal overflow.
- Verify authenticated flows with an available local test account/session fixture. If live OAuth is unavailable, explicitly report the limitation and distinguish fixture coverage from production sign-in verification.

## References

- Teal application organization: https://help.tealhq.com/en/articles/14435727-how-to-track-your-job-applications
- Huntr activity history: https://help.huntr.co/en/articles/10042702-activities
- Huntr resume/job matching, used as a later reference rather than a requirement for paid AI: https://help.huntr.co/en/articles/12241684-job-match-score
- Welcome to the Jungle role and company context: https://help.welcometothejungle.com/en/understand-job-offers-on-welcome-to-the-jungle
- Resend idempotency lifetime: https://resend.com/changelog/idempotency-keys
- Resend custom headers: https://resend.com/changelog/custom-email-headers
