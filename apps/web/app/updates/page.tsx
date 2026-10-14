import {database} from '@frontlanejobs/database/client';
import {discoveryPublicSummary} from '@frontlanejobs/core/employers';

type DiscoverySummary={registeredEmployers:number;lastRun:{completedAt:string|Date;status:string;registered:number;verified:number}|null};
const time=(value:string|Date)=>new Date(value).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' IST';
export default async function Page(){
  let rows:any[]=[],discovery:DiscoverySummary|null=null;
  try{rows=(await database().query('SELECT source,status,matched,checked_at FROM source_checks ORDER BY source')).rows}catch{}
  try{discovery=await discoveryPublicSummary(database())}catch{}
  const statuses:Record<string,string>={complete:'Completed',partial:'Completed with deferred work or unavailable sources','missing-key':'Search paused: configuration required','budget-exhausted':'Search allowance reached; queued boards can still be checked',failed:'Discovery unavailable'};
  return <article className="wrap prose-page">
    <div className="eyebrow">BEHIND THE BOARD</div><h1>Freshness you can see<span>.</span></h1>
    <p className="lead">Actual source results and verification dates.</p>
    <h2>Company discovery</h2>
    {discovery?.lastRun?<>
      <p>{discovery.lastRun.registered} new employers registered in the latest discovery run. {discovery.registeredEmployers} discovered employers are monitored in addition to the original employer boards.</p>
      <p>{statuses[discovery.lastRun.status]||'Discovery checked'} · {time(discovery.lastRun.completedAt)}</p>
    </>:<p>No completed company discovery runs yet. Once configured, discovery finds employer boards and verifies their live frontend openings before adding them to monitoring.</p>}
    <h2>Latest source checks</h2>
    {rows.length?<div className="source-table">{rows.map(r=><div key={r.source}><strong>{r.source}</strong><span>{r.status==='ok'?r.matched+' selected roles':'Unavailable'}</span><span>{time(r.checked_at)}</span></div>)}</div>:<p>No completed source checks yet. Listings will appear after the first refresh or starter-data import.</p>}
    <h2>What updates automatically</h2>
    <p>Employer feeds refresh daily when the production scheduler is enabled, targeting 50 frontend roles across employers and working arrangements. Company discovery searches for new employer boards when its separate scheduler is enabled. Verified employers join the regular refresh in rotating batches. Automated listings link to employer career pages. If fewer eligible roles are available, the refresh publishes fewer; failed sources and employers waiting for their next check retain their previous listings, so the total board can exceed 50. Research batches from ChatGPT can be published through the protected ingestion API. Contract, part-time and freelance roles are included when supplied by employers or a fresh verified research batch.</p>
    <h2>Dates mean different things</h2>
    <p>Discovery dates record when a job entered FrontlaneJobs. Employer posting dates appear only when supplied by the source. A source failure preserves its previous listings and is reported here.</p>
  </article>;
}
