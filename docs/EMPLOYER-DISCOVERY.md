# Automatic employer discovery

Discovery uses Brave Web Search to find Greenhouse, Lever, and SmartRecruiters employer boards beyond the original registered list. Search results are leads. A board is registered only after its official identity and live feed show eligible frontend roles in India or explicitly worldwide remote work. Missing or ambiguous employer identity and custom application links remain pending for rechecking. Ashby and custom careers sites require additional adapters.

## Configuration and activation

1. Create a Brave Search API account and key. Put `BRAVE_SEARCH_API_KEY` in the server's environment or root `.env.local` for local operation. Keep it out of source control. The provider currently lists $5 per 1,000 Search requests and $5 monthly credits: [official pricing](https://brave.com/search/api/). A dedicated key/account helps avoid other tools consuming the same credits; the provider dashboard controls billing and renewal.
2. Apply schema with `pnpm db:migrate`. This applies all sorted SQL files transactionally, including the employer registry and request ledger. Existing jobs remain intact.
3. Deploy the application and worker changes. The worker now requests the server's registry; deploy both together rather than using a new worker with an old server.
4. Set `APP_URL` and `CRON_SECRET` for the discovery command and run `pnpm jobs:discover`. The key remains on the server; the command needs no database credentials. Read the returned receipt. A `missing-key` receipt means no searches were issued.
5. Configure a separate hourly scheduler to call `GET <APP_URL>/api/cron/discovery` with `Authorization: Bearer <CRON_SECRET>` and a 30-second timeout. For cron-job.org use `0 * * * *` UTC and disable response-body storage. Keep only one discovery scheduler. Keep the existing daily `/api/cron/jobs` scheduler for job refresh.
6. After a receipt shows newly registered employers, run a regular refresh and inspect `/updates` and `/api/jobs` for their selected jobs. Discovery registration and job publication are separate receipts.

These instructions describe activation; local tests do not deploy or change production schedules.

## Search allowance

The application reserves at most **30 HTTP search attempts per UTC day** and **1,000 per UTC calendar month**, across all scheduler/manual calls. Day rollover is 05:30 IST; month rollover is 05:30 IST on the first day of the month. Thirty attempts daily amounts to at most 930 in a 31-day UTC month. These application periods do not determine Brave's credit renewal period, and other applications' usage is outside this ledger.

Reservations commit before HTTP requests. Failed responses, rate limits, network errors, and process crashes cannot refund a reservation. The first version requests one page of up to 20 results; it does not automatically retry or paginate Brave searches. One request can yield multiple employer leads, and duplicate boards merge into a single candidate. It never guarantees 30 completed searches or a number of new companies.

Each invocation has a 20-second work deadline, attempts at most two searches, and verifies at most four candidates. Database queries also receive time limits, with a further five seconds reserved for recording the receipt and releasing the lease. Trusted seeding and each search page's candidates are saved in single database statements. Verification runs before and after search so pending candidates can progress even after allowance is exhausted. Long or failing requests leave work queued. A database lease prevents overlapping invocations; a crash's lease expires after a minute. Query progression, candidates, quotas, and run results survive restarts.

## Monitoring and refresh behavior

Receipts include `status`, `searchesReserved`, `searchesSucceeded`, `candidatesAdded`, `verified`, `registered`, `noMatch`, `pending`, `failed`, `deferred`, and remaining `allowance`. `deferred` counts all unregistered candidates, including those awaiting a later retry; it does not mean every candidate is immediately due.

`/updates` exposes only aggregate latest-run information, total discovered registered employers, and source check dates. Raw search queries, pending board evidence, and keys are not public.

The regular refresh polls all original sources plus up to 20 discovered sources, ordered by least recent attempt. Failed sources also move through the polling rotation. Selection prioritizes employers least recently selected, separately from when their feed was checked; this avoids synchronization between the polling window and the 50-job selection target. Both the server and worker record selection priority and report deferred employers. A valid snapshot replaces only that checked employer's selected jobs. Failed, malformed, interrupted, and unpolled sources retain their jobs. Research batches and private trackers remain independent. Consequently total active listings can exceed 50, and a newly registered employer might wait for its turn.

More sources increase refresh duration. The existing external scheduler's default 30-second timeout may be too short for slow feeds; inspect its execution history and the application's source receipts. A scheduler timeout is not proof of either publication or failure. The server refresh has a bounded request deadline; an external worker can also perform the refresh with `pnpm jobs:refresh`.

## Failure statuses

| Condition | Result |
| --- | --- |
| Invalid or missing cron token | HTTP 401; no database/search work |
| Another discovery lease is active | HTTP 202 with `status: busy`; no search request |
| Brave key missing | `missing-key`; zero search reservations, queued verification may still run |
| Daily/monthly allowance exhausted | `budget-exhausted`; no new searches, queued verification can run |
| Search/verification error or deadline | `partial` or a deferred candidate; spent searches remain counted |
| No matching live jobs | Candidate is checked again after seven days |
| Identity cannot be verified | Candidate remains pending and is retried after one day |
| Database/schema unavailable | HTTP 503; migration/configuration must be corrected |

Transient verification errors retry with exponential delay up to one day. Candidates register only from live feeds, never from search snippets or guessed company names. Search indexing dates are not recorded as employer posting dates.
