# Web feature QA — 15 October 2026

Target: https://frontlanejobs.vercel.app, release `7f551af`.

## Result

The automated suite passes, but live testing found three issues. No product code was changed during this QA pass.

| Finding | Reproduction and evidence | Impact |
| --- | --- | --- |
| Company profiles return 404 | Open Companies, then Canonical. `/companies/greenhouse%3Acanonical` returns HTTP404. The literal-colon URL and CloudSEK profile also return404. The directory itself loads and its displayed logos load successfully. | Employer-profile navigation is broken. Inspect `apps/web/app/companies/[id]/page.tsx` and deployed route parameter handling; root cause is not yet established. |
| Company history becomes candidate experience | Open NEC's “Software Engineer - Full Stack Developer (Java+React)”, ID `4d42e74db5b4fa27b77a61878fd780c1d55636ba211e4fe308f440a864137131`. The detail panel says “Experience:30+ years · extracted from employer requirements”. Its description actually says the company has more than30 years of experience providing IT services. | Misleading requirement and potential recommendation penalty. `packages/core/src/job-enrichment.mjs` scans the entire narrative without candidate/requirements context. |
| Hybrid role labelled Onsite | The same NEC role says “This is a hybrid role, requiring3 days a week in the Magarpatta City, Pune office”, while its card, detail panel and arrangement metadata show Onsite. | Incorrect work-arrangement filtering. `packages/core/src/smartrecruiters.mjs` defaults absent remote/hybrid flags to on-site, overriding the description's explicit evidence. |

Experience evidence: [screenshot](../screenshots/qa-experience-bug.jpg).

## Automated verification

- `pnpm test`:134 passed,0 failed. Log: `/tmp/frontlane-feature-qa-tests.log`.
- `pnpm build`:exit0. Log: `/tmp/frontlane-feature-qa-build.log`.
- `pnpm typecheck`:exit0 for web and shared mobile consumers. Log: `/tmp/frontlane-feature-qa-typecheck.log`.
- The suite covers structured workspace validation, private ownership, revision conflicts/history, matching restrictions, salary units, first-publication deduplication, saved-search boundaries, unsubscribe, signed Resend webhooks, Gmail rejection classification, ambiguous sends, durable budget and provider-switch behavior. It does not establish actual Gmail authentication or inbox delivery.

## Live checks

| Area | Result |
| --- | --- |
| Multi-stack + city filters | React OR Angular with Mumbai produced8 roles; every displayed role was in Mumbai and matched either stack. Filter state appeared in the URL. |
| Role details | Open/close works, source link and full description render. Data issues above remain. |
| Comparison | Selecting Bosch and BitGo opens a two-role comparison with distinct facts and explicit unknown values. |
| Company directory/media | Directory and displayed Canonical/CloudSEK/GitLab logos load; profile navigation fails as above. |
| Recommendations | With no structured preferences, For you correctly shows setup instructions. Ranking/filter behavior is covered by automated tests; live personalized ranking was not tested by altering the user's profile. |
| Saved searches | Temporary React/Angular/Mumbai search created, persisted in Inbox, paused, re-enabled, and paused again. Checking for new jobs did not flood historical alerts. User approved deletion; the temporary search was deleted and its absence verified. |
| Tracker views | Existing2 saved applications load. Today shows the existing overdue follow-up; table, board, archive empty state, and progress views render. Existing applications were not edited. |
| Interview form/calendar | An unsaved interview round exposes time, meeting link, notes, status and outcome fields. Calendar download generated `/Users/ayushsanj/Downloads/interview.ics` with a VCALENDAR/VEVENT, start/end dates and real CRLF line endings. Browser automation's download wait timed out even though the file downloaded; not counted as a product failure. The round was not saved. |
| Responsive/themes | Job board measured no document overflow at360px and768px. Company directory measured no overflow at768px; tracker measured no overflow at360px. Mobile layout visually inspected. Light and dark switches work. Original dark theme and default viewport restored. |
| Email settings | Gmail configuration makes the opt-in control available; matching remains default. No email subscription was enabled and no live email was sent. Inbox delivery remains unverified. |
| Private API access | Unauthenticated tracker, profile, recommendations, saved searches, notifications, digest subscription, tracker metrics and digest cron all return401. |
| Inactive Resend webhook | Unsigned request returns503 because Resend webhook configuration is absent in the active Gmail setup. No recipient mutation occurred. Signed/unsigned Resend behavior is covered locally with the provider configured. |

## Limits and cleanup

This was a combination of automated behavior tests and live browser smoke tests, not an exhaustive manual test of every persistence path. Contacts, documents, offers and stage-history writes were tested through the automated suite rather than by editing the user's live applications. No recruiter communications, employer applications, job publication or real emails were triggered. Temporary saved search removed with explicit approval; unsaved interview draft did not reach the database. The downloaded calendar remains in Downloads as test evidence. Existing user work, including the unrelated `frontlanejobs-logo.png`, was preserved.
