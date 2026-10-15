# Daily job notifications

Signed-in users receive a one-time consent prompt. Email and browser push are independent and unchecked for new users; existing email subscriptions are preserved. “Maybe later” records that the prompt was reviewed without enrolling anyone. Account and Inbox settings allow later changes. Matching notifications require explicit matching preferences; onboarding offers a short skills/work-arrangement setup. Changing notification mode resets the publication boundary and suppresses obsolete queued deliveries.

## Daily publication and retries

The employer cron creates the daily campaign only after 08:00 IST, following a successful source refresh. Later refreshes may recover a missed morning run but never create another campaign for that day. New jobs after the shared cutoff roll into the next day. Closed, baseline, previously processed and hidden jobs are excluded. Matching uses the existing recommendation logic; no new qualifying jobs means no delivery.

Email and push share the publication cutoff, with independent campaign paging and outboxes. Existing `/api/cron/digests` retries drain both channels; do not add a competing scheduler. Each subscribed device has one push delivery per campaign. Explicit temporary provider failures retry within 48 hours and a bounded attempt count. Expired subscriptions are disabled; uncertain delivery outcomes are marked ambiguous rather than repeatedly sent. A stable daily notification tag replaces duplicates at the browser. Delivery acceptance does not guarantee browser display or email inbox placement.

## Configuration

Apply migration `012-notification-consent.sql`. Local operational commands read root `.env.local`; copy the same notification settings into deployment configuration securely before deployment:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: public P-256 Web Push key.
- `VAPID_PRIVATE_KEY`: matching private key, server-only. Generate once and keep the pair stable; changing it requires re-enrollment.
- `VAPID_SUBJECT`: operator HTTPS URL or `mailto:` contact.
- `NOTIFICATION_APP_URL`: optional canonical HTTPS origin for notification links and readiness. Defaults to `APP_URL`. Local development may keep `APP_URL=http://localhost:3000` for OAuth while using the HTTPS production/staging origin here.
- Email launch: `EMAIL_PROVIDER=gmail`, `GMAIL_USER` set to the verified owner of the existing `GMAIL_APP_PASSWORD`. Never infer the account from the password or commit credentials. Existing Resend configuration remains supported.

The implementation generated a stable local VAPID pair without printing its private key. The confirmed local Gmail sender is frontlanejobs@gmail.com; SMTP authentication was verified without sending an email. Production configuration and deployment remain separate rollout steps. Do not send test messages to existing users: use a deliberately opted-in test account/device.

## Browser behavior

The browser permission prompt appears only from the user's explicit Save gesture after checking push. Permission denial does not prevent saving email consent. Push requires a secure browser context (localhost is supported by browsers) and platform support. iPhone/iPad users must add the app to their Home Screen and open it there. No service worker caches pages, credentials or API responses. Notification clicks open the authenticated Inbox, which shows the latest delivered job summary. Sign-out disables the device's server subscription; re-enabling it requires an explicit user choice.

Only authenticated web sessions can manage subscriptions. Mutations require the configured same origin. Subscription data is private, account-bound, limited to ten enabled devices, and restricted to supported browser push providers. Status responses expose configuration readiness and this device's settings, never subscription endpoints or private keys.

## Verification

Run `pnpm test`, `pnpm typecheck`, and `pnpm build`. Integration coverage includes consent, morning gating, source publication boundaries, matching, replay, shared cutoffs, channel independence, expired subscriptions, account isolation and foreign-origin rejection. Browser checks cover unchecked defaults, quick setup, skipping, persistence, desktop/mobile layout, permission denied/unsupported states and notification click navigation. Actual provider delivery requires a consenting test account and configured sender/device.

The employer cron retains `emailDigests` email statistics and adds `pushDigests`. The retry endpoint preserves its email status fields and adds a `push` result.
