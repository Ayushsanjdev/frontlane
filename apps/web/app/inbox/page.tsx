import {requireUser} from '@/lib/session';
import {database} from '@frontlanejobs/database/client';
import Inbox from './inbox';
import type {Job} from '@/lib/types';
export default async function Page(){
  const user=await requireUser('/inbox');let daily:{publication_day:string;jobs:Job[]}|null=null;
  try{daily=(await database().query("SELECT d.publication_day,d.jobs FROM push_deliveries d JOIN push_subscriptions s ON s.id=d.subscription_id WHERE s.user_id=$1 AND d.status='accepted' ORDER BY d.publication_day DESC,d.created_at DESC LIMIT 1",[user.userId])).rows[0]||null}catch{}
  return <>{daily&&<section className="wrap workspace-page"><div className="eyebrow">{daily.publication_day} · DAILY JOB SUMMARY</div><h2>Jobs from your latest notification</h2><p className="muted">Matched when the summary was prepared. Availability may have changed.</p><div className="job-list">{daily.jobs.map(job=><a className="job-card" key={job.id} href={'/jobs?job='+encodeURIComponent(job.id)}><small>{job.company}</small><h3>{job.title}</h3><p>{job.location} · {job.type}</p></a>)}</div></section>}<Inbox/></>;
}
