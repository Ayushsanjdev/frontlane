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
    {rows.length?<div className="source-table">{rows.map(r=><div key={r.source}><strong>{r.source}</strong><span>{r.status==='ok'?r.matched+' available roles':r.status==='partial'?r.matched+' roles · Partial check':'Unavailable'}</span><span>{time(r.checked_at)}</span></div>)}</div>:<p>No completed source checks yet. Listings will appear after the first refresh or starter-data import.</p>}
    <h2>What updates automatically</h2>
    <p>Employer feeds are scheduled at 08:00, 16:00 and 00:00 IST. Successful complete checks publish all eligible frontend roles from Greenhouse, Lever, SmartRecruiters, Ashby and Amazon; up to 50 are selected for featured placement. Failed sources retain their previous listings. Company discovery adds verified employer boards in rotating batches. Contract, part-time, freelance and internship roles appear when employers supply eligible listings. The source results above show what actually completed.</p>
    <h2>Remote jobs</h2>
    <p><a href="/jobs/remote">The remote board</a> includes frontend roles explicitly open worldwide or to applicants in India. Remote OK, We Work Remotely and HN Who is hiring use a separate refresh when configured. Original source links and credits appear on each listing. Unknown geographic eligibility is excluded. Listings not seen for 45 days expire; a failed check keeps previous listings until that expiry.</p>
    <h2>Dates mean different things</h2>
    <p>Discovery dates record when a job entered FrontlaneJobs. Employer posting dates appear only when supplied by the source. A source failure preserves its previous listings and is reported here.</p>
  </article>;
}
