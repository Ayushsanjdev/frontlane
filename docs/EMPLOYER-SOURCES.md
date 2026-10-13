# Employer source discovery

The daily cron refreshes the employer boards registered in `packages/core/src/sources.mjs`. It does not discover new employers automatically. The source list now contains 39 boards; the daily selection target remains 50 unique eligible jobs across employers and working arrangements.

## Sources verified on 2026-10-13

These seven newly monitored boards returned eight eligible roles through their official ATS APIs. These are discovery/check dates, not employer posting dates. Listings can close between checks.

| Employer | Source | Example verified role | Location |
| --- | --- | --- | --- |
| SonicWall | `greenhouse:sonicwall` | [Principal Frontend Engineer](https://job-boards.greenhouse.io/sonicwall/jobs/8138758) | Pune |
| Hyreo | `greenhouse:hyreo` | [Software Engineer (Frontend) - SCM IB](https://job-boards.greenhouse.io/hyreo/jobs/5317634004) | Bengaluru |
| Sigmoid | `greenhouse:sigmoid` | [Software Development Engineer II - Frontend](https://job-boards.greenhouse.io/sigmoid/jobs/8844035002) | Bengaluru |
| OpenFX | `greenhouse:openfx` | [Senior Frontend Engineer (L5) - Banking](https://job-boards.greenhouse.io/openfx/jobs/5373810008) | Bengaluru |
| HighLevel | `lever:gohighlevel` | [Staff Frontend Engineer - Commerce](https://jobs.lever.co/gohighlevel/9acb805c-ecd6-48ac-af84-11c6319c1912) | Remote, India |
| Lingaro | `lever:lingarogroup` | [Front End Developer](https://jobs.lever.co/lingarogroup/a208f821-9dd8-4b35-b784-55313784c5db) | Remote, India |
| Synergy Machines | `smartrecruiters:synergymachines` | [Senior Development Engineer - React Frontend](https://jobs.smartrecruiters.com/SynergyMachines/743999796985247-senior-development-engineer-react-frontend) | Remote, Gurugram, India |

HighLevel also returned [Staff Engineer - Platform Frontend](https://jobs.lever.co/gohighlevel/5b51c71b-a61e-41e4-82e3-7fa4deb2678a).

## Adding more employers

1. Periodically search official employer career pages for frontend, React, Angular, Vue, UI engineering, and web engineering roles in India or explicitly worldwide remote roles. Search results are leads; verify the live feed and application page before adding a source.
2. For supported Greenhouse, Lever, or SmartRecruiters boards, confirm the board identifier and employer attribution. Run `refreshSources` with the candidate boards and a callback that only captures batches, without ingesting them. Add boards with verified eligible roles to `SOURCES`.
3. Keep existing eligibility checks, job validation, canonical URL deduplication, and the shared daily selection target. Do not add broken feeds or fabricate posting dates, salaries, eligibility, or working arrangements.
4. Run the repository checks, deploy the source-list change, and run a refresh. Inspect its per-source receipts and verify the public `/api/jobs` response and `/updates` timestamps. An immediate refresh from local code updates stored jobs but does not deploy the new source list to production.
5. For employers on unsupported platforms, use a verified additive research batch as described in [CHATGPT-UPDATER.md](CHATGPT-UPDATER.md). Adding an automatic adapter is a separate code change.

The cron continues polling monitored boards even when they have no eligible openings. Successful snapshots close previously selected jobs from that source; failed sources preserve their previous listings. Private tracker entries are not removed by feed refreshes.
