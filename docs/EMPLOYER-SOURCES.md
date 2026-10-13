# Employer source discovery

The daily cron refreshes the employer boards registered in `packages/core/src/sources.mjs`. It does not discover new employers automatically. The source list now contains 43 boards; the daily selection target remains 50 unique eligible jobs across employers and working arrangements.

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

## Additional research on 2026-10-13

Checked the existing 39 source identifiers and employer names before adding these four distinct employers. Candidate feeds were tested with `refreshSources` and a capture-only callback before publication. They returned 12 eligible roles in total; the shared 50-job selection still determines how many are published from each board.

| Employer and official careers | Supported feed | Verified example | Location | Eligible roles in candidate feed |
| --- | --- | --- | --- | --- |
| [MeltPlan](https://www.meltplan.com/careers) | `greenhouse:meltplan` | [Senior Full Stack Engineer – Frontend Focused](https://job-boards.greenhouse.io/meltplan/jobs/4146430009) | Bengaluru, India | 2 |
| [Poppulo](https://www.poppulo.com/careers) | `greenhouse:poppulo` | [Software Development Engineer II - Frontend / Full Stack](https://job-boards.greenhouse.io/poppulo/jobs/8146847) | Bengaluru, India - Hybrid | 1 |
| [Sia](https://www.sia-partners.com/en/opportunities) | `smartrecruiters:sia` | [Senior Frontend Engineer (Reactjs)](https://jobs.smartrecruiters.com/Sia/744000143767580-senior-frontend-engineer-reactjs-) | Mumbai, India; description explicitly onsite | 2 |
| [NEC Software Solutions](https://www.necsws.com/careers/) | `smartrecruiters:necsws` | [Frontend Developer - Angular](https://jobs.smartrecruiters.com/NECSWS/744000152342390-frontend-developer-angular) | Mumbai, India | 7 |

MeltPlan's careers page links both the example and [UI Engineering Lead](https://job-boards.greenhouse.io/meltplan/jobs/4250926009). Poppulo's rendered open-roles section links the exact Greenhouse requisition. Sia's two distinct requisitions include [Senior Full Stack Engineer (Frontend)](https://jobs.smartrecruiters.com/Sia/744000143768199-senior-full-stack-engineer-frontend-). NEC's careers page links its `NECSWS` SmartRecruiters board; its feed also returned a frontend Node.js role in Bengaluru and a Java/React role in Pune. The NEC Angular-titled example currently describes a .NET/Blazor frontend platform: applicants should read the full description rather than infer the stack from its title.

### Leads not added

- Level AI's legacy Lever API still returned a Noida frontend role, but its [official careers page](https://thelevel.ai/careers) now links [Ashby](https://jobs.ashbyhq.com/level-ai). Do not add the legacy board without resolving this migration. Ashby remains unsupported by the current automatic adapters.
- Celonis, Yugabyte, Eltropy, Glean, FalconX, Zuora, Plivo, Dialpad, Crunchyroll, Deliveroo, New Relic, Vonage, Sprinto, and Sectigo returned no eligible roles under the unchanged filters during these checks. Cached search results were not treated as proof of a live opening.
- Candidate board identifiers for Atomicwork, Tekion, Sprinklr, Sarvam, Atlan, Granicus, Phenom, and Eightfold returned HTTP 404. This does not imply the employers have no vacancies; locate their current official ATS before retrying.
- Typeset's SmartRecruiters feed returned a Bengaluru frontend role, but current employer-careers attribution was not verified, so it was not added.

The previous source additions and HTML cleaner fix are already deployed: Vercel's production overview showed commit `94ce4af` as Ready on `frontlanejobs.vercel.app` during this research. The four additions above require a subsequent deployment.

## Adding more employers

1. Periodically search official employer career pages for frontend, React, Angular, Vue, UI engineering, and web engineering roles in India or explicitly worldwide remote roles. Search results are leads; verify the live feed and application page before adding a source.
2. For supported Greenhouse, Lever, or SmartRecruiters boards, confirm the board identifier and employer attribution. Run `refreshSources` with the candidate boards and a callback that only captures batches, without ingesting them. Add boards with verified eligible roles to `SOURCES`.
3. Keep existing eligibility checks, job validation, canonical URL deduplication, and the shared daily selection target. Do not add broken feeds or fabricate posting dates, salaries, eligibility, or working arrangements.
4. Run the repository checks, deploy the source-list change, and run a refresh. Inspect its per-source receipts and verify the public `/api/jobs` response and `/updates` timestamps. An immediate refresh from local code updates stored jobs but does not deploy the new source list to production.
5. For employers on unsupported platforms, use a verified additive research batch as described in [CHATGPT-UPDATER.md](CHATGPT-UPDATER.md). Adding an automatic adapter is a separate code change.

The cron continues polling monitored boards even when they have no eligible openings. Successful snapshots close previously selected jobs from that source; failed sources preserve their previous listings. Private tracker entries are not removed by feed refreshes.
