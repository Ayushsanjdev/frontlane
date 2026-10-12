# Daily refresh with cron-job.org

The scheduler calls the existing production refresh endpoint directly. It does not use GitHub Actions and does not deploy the app.

Active job: [FrontlaneJobs daily employer refresh, ID 8632316](https://console.cron-job.org/jobs). Its creation test returned HTTP 200 in 16.65 seconds, publishing 50 jobs with no failed sources. The console confirmed the next execution at 08:00 IST.

Configure one job with these settings:

| Setting | Value |
| --- | --- |
| Title | FrontlaneJobs daily employer refresh |
| URL | `https://frontlanejobs.vercel.app/api/cron/jobs` |
| Method | GET |
| Time zone | UTC |
| Schedule | Every day at 02:30 UTC, equivalent to 08:00 IST |
| Crontab | `30 2 * * *` |
| Header name | `Authorization` |
| Header value | `Bearer <CRON_SECRET>` |
| Save response bodies | Off |

Use the same `CRON_SECRET` set in the Vercel Production environment. Keep it in the scheduler's header field, not in the URL or this repository. The endpoint rejects absent or incorrect tokens before accessing the database.

Run a test before enabling the schedule. HTTP 200 means the refresh completed; its summary reports published jobs, source failures, and any shortfall. HTTP 202 means another refresh already holds the database lock. HTTP 401 means the scheduler token does not match Vercel. HTTP 503 means the refresh was unavailable or every source failed.

The default scheduler timeout is 30 seconds. A production test on 2026-10-13 completed in 17.84 seconds, publishing 50 jobs with no failed sources. This is one measured run, not a guarantee: slow employer feeds can take longer. Check cron-job.org execution history and Vercel logs after a timeout, and use `/updates` to verify source timestamps. Do not assume a timed-out request published successfully.

Vercel Cron is disabled in Project Settings → Cron Jobs. The `crons` entry is removed from `apps/web/vercel.json`, and the GitHub refresh workflow is manual-only. Deploy these repository changes with the next app update; the external job is already active against the existing production endpoint. Keep Vercel Cron disabled and do not restore automatic GitHub scheduling unless switching away from cron-job.org.

References: [cron-job.org FAQ](https://cron-job.org/en/faq/) and [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
