# Daily notification consent — implementation ledger

Approved plan: one post-sign-in prompt, independent unchecked email/push consent, quick matching preferences setup, daily matching summaries after 08:00 IST, no messages without new matching publications. Browser push only; existing email and retry scheduler retained. New secrets must also be configured locally, never committed.

Ruling: continue in the existing dirty checkout because the user authorized implementation on this existing work; moving to a clean worktree would omit required uncommitted email and Explore functionality. Preserve unrelated changes; no commits or deployment.
Ruling: durable per-channel campaigns share a daily cutoff, but independent paging/outboxes avoid coupling channel readiness. Email sender identity remains a configuration prerequisite; do not infer it from an app password.

- [x] Core migrations, consent/subscriptions, daily cutoff, matching and push outbox; integration tests.
- [x] Authenticated APIs, prompt/settings, quick setup, service worker, manifest and sign-out cleanup.
- [x] Scheduler integration, local VAPID configuration and documentation.
- [x] Full checks, browser verification and independent review.

Ruling: added NOTIFICATION_APP_URL as a canonical HTTPS delivery-link origin while preserving local APP_URL for OAuth and same-origin API checks. This avoids making email readiness depend on changing localhost authentication configuration.
Ruling: disabled endpoint transfer creates a new subscription ID and retires the previous endpoint identity, preserving the original account's delivery history.

Verification so far: migration applied; Gmail SMTP authentication verified for the user-confirmed frontlanejobs@gmail.com without sending email; local sender/provider/VAPID/canonical origin configured. Full suite 178 passed before two final transport/channel checks; focused 13 passed and channel independence passed. Independent review's five findings fixed and rechecked with regression coverage. Desktop and 390px mobile prompt checked; existing email opt-in preserved, push off, quick matching setup rendered. No consent was submitted or test notification sent from the real account.

Final verification: all 180 tests passed; latest API compatibility edits passed 19 focused route/delivery tests; typecheck and final production build passed. Service worker and manifest return HTTP 200 with no-cache worker headers. No paid notification platform added. Production env configuration/deployment and a deliberately opted-in real-device delivery check remain rollout steps; no real-account consent was submitted.
