import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {discoveryTransaction} from './discovery-store.mjs';
import {filterSeedJobs} from './jobs.mjs';
import {WorkspaceError} from './tracker-store.mjs';
export function normalizeSearchCriteria(value){
  const input=new URLSearchParams(z.string().max(2000).parse(value)),output=new URLSearchParams();
  for(const key of ['q','type','mode','stack','city','seniority','compensationKnown','salaryMin','currency','payPeriod'])for(const entry of input.getAll(key).slice(0,30))if(entry&&entry!=='All')output.append(key,entry.slice(0,100));
  output.sort();return output.toString();
}
const searchInput=z.object({id:z.string().uuid().optional(),name:z.string().trim().min(1).max(100),criteria:z.string().max(2000),enabled:z.boolean()}).strict();
export async function saveSearch(db,userId,input){
  const value=searchInput.parse(input),criteria=normalizeSearchCriteria(value.criteria);
  return discoveryTransaction(db,async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['saved-search:'+userId]);
    if(value.id){const result=await client.query('UPDATE saved_searches SET name=$3,criteria=$4,enabled=$5,boundary=(SELECT COALESCE(max(sequence),0) FROM job_first_publications) WHERE id=$1 AND user_id=$2 RETURNING *',[value.id,userId,value.name,criteria,value.enabled]);if(!result.rows.length)throw new WorkspaceError('Search not found',404);return result.rows[0]}
    const count=await client.query('SELECT count(*)::int AS n FROM saved_searches WHERE user_id=$1',[userId]);if(count.rows[0].n>=20)throw new WorkspaceError('You can save up to 20 searches.',400);
    const boundary=(await client.query('SELECT COALESCE(max(sequence),0)::int AS boundary FROM job_first_publications')).rows[0].boundary;
    return (await client.query('INSERT INTO saved_searches(id,user_id,name,criteria,enabled,boundary) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[randomUUID(),userId,value.name,criteria,value.enabled,boundary])).rows[0];
  });
}
export async function evaluateNotifications(db,userId){
  return discoveryTransaction(db,async client=>{
    const searches=(await client.query('SELECT * FROM saved_searches WHERE user_id=$1 AND enabled=true FOR UPDATE',[userId])).rows;
    const feedback=(await client.query('SELECT kind,target FROM job_feedback WHERE user_id=$1',[userId])).rows;
    let added=0;
    for(const search of searches){
      const events=(await client.query("SELECT p.sequence,p.canonical_url,p.baseline,j.payload FROM job_first_publications p LEFT JOIN LATERAL (SELECT payload FROM jobs WHERE canonical_url=p.canonical_url AND active=true ORDER BY (source='community'),discovered_at DESC LIMIT 1) j ON true WHERE p.sequence>$1 ORDER BY p.sequence LIMIT 1000",[search.boundary])).rows;
      for(const event of events){const job=event.payload;if(!job||event.baseline||feedback.some(row=>row.kind==='job'&&row.target===job.id||row.kind==='company'&&row.target===job.company.toLowerCase()))continue;if(!filterSeedJobs([job],new URLSearchParams(search.criteria)).total)continue;
        const result=await client.query('INSERT INTO job_notifications(id,user_id,search_id,canonical_url,job) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id',[randomUUID(),userId,search.id,event.canonical_url,job]);added+=result.rows.length;
      }
      if(events.length)await client.query('UPDATE saved_searches SET boundary=$2 WHERE id=$1',[search.id,events.at(-1).sequence]);
    }
    return {added};
  });
}
