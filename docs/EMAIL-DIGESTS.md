# Daily job email digests

Daily digests are an opt-in web feature. Members use their verified Google account email and choose matching jobs (default, requires explicit preferences) or all newly published jobs. New subscriptions start at the current publication boundary, without emailing the old catalogue. A day with no new qualifying jobs sends no email.

## Gmail activation without a custom domain

For a small launch, configure `EMAIL_PROVIDER=gmail`, `GMAIL_USER=frontlanejobs@gmail.com`, and `GMAIL_APP_PASSWORD` in Vercel Production. The password must be a Google app password created after enabling two-step verification; never use the account password or put credentials in Git/chat. Keep the existing HTTPS `APP_URL` and `CRON_SECRET`. Apply migration 010 and redeploy. Gmail does not require Resend keys, a custom domain, or a Resend webhook.

The Gmail transport uses authenticated TLS on smtp.gmail.com:465. The app reserves at most 100 attempts across all workers in a rolling 24-hour period, including explicit temporary rejections. This conservative launch cap is not a guarantee of Google quota or inbox delivery. Extra work stays queued until budget returns and expires under the existing 48-hour rule. Use a dedicated Gmail account.

SMTP has no provider idempotency guarantee. Explicit temporary SMTP rejections can retry; timeouts, unclear acceptance, and expired Gmail send leases become ambiguous and require operator reconciliation. A stable Message-ID assists reconciliation but does not guarantee deduplication. Already attempted deliveries cannot switch providers. For never-attempted deliveries only, the configured sender binds at first claim; content, recipient and unsubscribe token remain unchanged. Once attempted, the body stays frozen. Only an explicit invalid-recipient 5.1.1 response suppresses a subscriber; generic policy rejection does not. Gmail SMTP acceptance is recorded as accepted, with no delivery webhook confirmation or asynchronous bounce/complaint suppression. Monitor the dedicated sender mailbox for later bounces.

The existing three daily employer refreshes and ten-minute digest retry schedule serve either provider. New daily campaigns begin after 08:00 IST; subsequent refreshes recover missed work without creating another daily campaign. Verify with a controlled opted-in account after adding the secret; do not claim inbox delivery from configuration presence alone. Google may block a new server sign-in, so authentication must be verified from the deployed runtime.

References: [Nodemailer Gmail guide](https://nodemailer.com/guides/using-gmail), [Google app passwords](https://support.google.com/mail/answer/185833), [Gmail limits](https://support.google.com/mail/answer/22839).

## Resend activation with a verified domain

1. Apply all migrations with `pnpm db:migrate` against the intended database branch. Do not run it against production without confirming the target.
2. Create a Resend sending API key and verify a sender domain with the provider's required DNS records. Configure `RESEND_API_KEY`, `EMAIL_FROM` (for example `FrontlaneJobs <jobs@your-domain>`), an HTTPS `APP_URL`, and the existing `CRON_SECRET`. Never put credentials in Git.
3. Register the Resend webhook at `/api/email-webhook` for `email.delivered`, `email.bounced`, and `email.complained`. Set its signing secret as `RESEND_WEBHOOK_SECRET`. Requests are verified using their original bytes and the official Svix verifier. Unsigned requests do not access the database.
4. Keep the existing daily `/api/cron/jobs` schedule. After a successful committed refresh it creates the daily Asia/Kolkata campaign and spends a bounded amount of remaining time draining the queue. Provider failures do not roll back job publication.
5. Add a separate cron-job.org request to `GET /api/cron/digests` every ten minutes, with the same bearer `CRON_SECRET`. This resumes incomplete campaign creation and pending deliveries. Disable response-body storage. The endpoint does not independently create a daily campaign when the refresh failed.
6. Verify with a controlled, opted-in account after deployment. Local tests use injected transports and do not send mail. No sender or external schedule is provisioned by this code change.

The web UI disables subscription activation until all configuration exists. In-app alerts and job browsing work without an email provider. Provider verification and actual inbox delivery are deployment checks.

## Delivery behavior

Only first public publications produce a digest event. Rechecks, reselection after rotation, and duplicate canonical application URLs do not. Source availability and public selection are separate: leaving today's selection does not prove a job closed. Partial successful refreshes can produce new jobs; a complete failure or skipped concurrent refresh does not start a campaign. Newly published community/research roles before the daily cutoff are included.

Each member has one immutable delivery per publication day. It freezes the recipient, subscription generation/mode, full job snapshot, HTML/plain text, and provider idempotency key. The sender binds before the first attempt so an unattempted delivery can safely move between configured providers. The email shows up to 20 jobs and links to a private page containing the full snapshot. No private contact notes, application answers, or document URLs enter email content.

Short database transactions claim queue items; provider network requests happen outside transactions. Temporary/rate-limit/network errors back off. Resend retains idempotency keys for 24 hours; the implementation stops uncertain retries after 23 hours to leave a margin. Those deliveries become `ambiguous` and require operator reconciliation, rather than risking duplicates. Never reset a delivery's immutable body or first-attempt timestamp to force a retry. Unattempted digests expire after 48 hours.

`accepted` means the provider accepted the API request, not mailbox delivery. Signed webhook events can mark `delivered`; bounces/complaints suppress the recipient and pending work. Unknown provider IDs return a retryable response so early webhooks are not silently lost before acceptance is recorded. Monitor `email_deliveries.status`, retry times, and the count-only cron results. Avoid logging recipients, raw tokens, message bodies, API keys, or webhook secrets.

## Unsubscribe and privacy

Visible email links open `/unsubscribe`, a confirmation page that does not mutate on GET, protecting against link scanners. `List-Unsubscribe` points to the token-authorized `/api/unsubscribe` POST and supports one-click clients. Tokens are random, hashed for lookup, and tied to a subscription generation. Raw tokens occur only inside private frozen delivery content. Disabling emails or changing recipient/mode cancels pending work from old generations. Already delivered unsubscribe links remain valid while the verified recipient is unchanged; changing the recipient invalidates links for the old address. Signed-in members can manage preferences in `/account#email`.

SQL migrations are idempotent. Email tables contain private recipient/delivery data and must be covered by existing database backups and access controls. The code does not send recruiter messages or submit applications.

Provider references: [Resend API](https://resend.com/docs/api-reference/emails/send-email), [idempotency lifetime](https://resend.com/changelog/idempotency-keys), [webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests).

Daily consent onboarding, browser push and the shared publication cutoff are documented in [notification operations](NOTIFICATIONS.md). Apply migration 012 and configure the same VAPID pair locally and in the deployment environment.
