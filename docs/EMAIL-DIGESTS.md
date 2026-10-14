# Daily job email digests

Daily digests are an opt-in web feature. Members use their verified Google account email and choose matching jobs (default, requires explicit preferences) or all newly published jobs. New subscriptions start at the current publication boundary, without emailing the old catalogue. A day with no new qualifying jobs sends no email.

## Activate in a deployment

1. Apply all migrations with `pnpm db:migrate` against the intended database branch. Do not run it against production without confirming the target.
2. Create a Resend sending API key and verify a sender domain with the provider's required DNS records. Configure `RESEND_API_KEY`, `EMAIL_FROM` (for example `FrontlaneJobs <jobs@your-domain>`), an HTTPS `APP_URL`, and the existing `CRON_SECRET`. Never put credentials in Git.
3. Register the Resend webhook at `/api/email-webhook` for `email.delivered`, `email.bounced`, and `email.complained`. Set its signing secret as `RESEND_WEBHOOK_SECRET`. Requests are verified using their original bytes and the official Svix verifier. Unsigned requests do not access the database.
4. Keep the existing daily `/api/cron/jobs` schedule. After a successful committed refresh it creates the daily Asia/Kolkata campaign and spends a bounded amount of remaining time draining the queue. Provider failures do not roll back job publication.
5. Add a separate cron-job.org request to `GET /api/cron/digests` every ten minutes, with the same bearer `CRON_SECRET`. This resumes incomplete campaign creation and pending deliveries. Disable response-body storage. The endpoint does not independently create a daily campaign when the refresh failed.
6. Verify with a controlled, opted-in account after deployment. Local tests use injected transports and do not send mail. No sender or external schedule is provisioned by this code change.

The web UI disables subscription activation until all configuration exists. In-app alerts and job browsing work without an email provider. Provider verification and actual inbox delivery are deployment checks.

## Delivery behavior

Only first public publications produce a digest event. Rechecks, reselection after rotation, and duplicate canonical application URLs do not. Source availability and public selection are separate: leaving today's selection does not prove a job closed. Partial successful refreshes can produce new jobs; a complete failure or skipped concurrent refresh does not start a campaign. Newly published community/research roles before the daily cutoff are included.

Each member has one immutable delivery per publication day. It freezes the recipient, subscription generation/mode, full job snapshot, HTML/plain text, and provider idempotency key. The email shows up to 20 jobs and links to a private page containing the full snapshot. No private contact notes, application answers, or document URLs enter email content.

Short database transactions claim queue items; provider network requests happen outside transactions. Temporary/rate-limit/network errors back off. Resend retains idempotency keys for 24 hours; the implementation stops uncertain retries after 23 hours to leave a margin. Those deliveries become `ambiguous` and require operator reconciliation, rather than risking duplicates. Never reset a delivery's immutable body or first-attempt timestamp to force a retry. Unattempted digests expire after 48 hours.

`accepted` means the provider accepted the API request, not mailbox delivery. Signed webhook events can mark `delivered`; bounces/complaints suppress the recipient and pending work. Unknown provider IDs return a retryable response so early webhooks are not silently lost before acceptance is recorded. Monitor `email_deliveries.status`, retry times, and the count-only cron results. Avoid logging recipients, raw tokens, message bodies, API keys, or webhook secrets.

## Unsubscribe and privacy

Visible email links open `/unsubscribe`, a confirmation page that does not mutate on GET, protecting against link scanners. `List-Unsubscribe` points to the token-authorized `/api/unsubscribe` POST and supports one-click clients. Tokens are random, hashed for lookup, and tied to a subscription generation. Raw tokens occur only inside private frozen delivery content. Disabling emails or changing recipient/mode cancels pending work from old generations. Already delivered unsubscribe links remain valid while the verified recipient is unchanged; changing the recipient invalidates links for the old address. Signed-in members can manage preferences in `/account#email`.

SQL migrations are idempotent. Email tables contain private recipient/delivery data and must be covered by existing database backups and access controls. The code does not send recruiter messages or submit applications.

Provider references: [Resend API](https://resend.com/docs/api-reference/emails/send-email), [idempotency lifetime](https://resend.com/changelog/idempotency-keys), [webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests).
