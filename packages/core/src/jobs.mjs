import {summarizeFeedHealth} from './feed-health.mjs';
import {resolveCompany} from '@frontlanejobs/database/companies';
import {exploreConditions,matchesExplore,isExploreSearch,companyIdentitySQL} from './explore.mjs';
import {REMOTE_SOURCES,isRemoteSource} from './remote-eligibility.mjs';
function options(params){
  const number=(key,fallback,max)=>Math.min(max,Math.max(1,Math.floor(Number(params.get(key))||fallback)));
  return {page:number('page',1,200),limit:number('limit',20,100),q:(params.get('q')||'').slice(0,100),sort:params.get('sort')||'recommended'};
}

export async function listJobs(db,params=new URLSearchParams()){
  const {page,limit,q,sort}=options(params);
  const args=[],conditions=publicJobConditions(params,args);
  conditions.push(...exploreConditions(params,args));
  if(params.get('featured')==='1')conditions.push("COALESCE((payload->>'featured')::boolean,true)=true");
  let qIndex=0;
  if(q){
    args.push('%'+q.replace(/[\\%_]/g,'\\$&')+'%');
    qIndex=args.length;
    conditions.push(`concat_ws(' ',payload->>'title',payload->>'company',payload->>'location',COALESCE(payload->'tags','[]'::jsonb)::text) ILIKE $${args.length}`);
  }
  for(const key of ['type','mode'])if(params.get(key)&&params.get(key)!=='All'){
    args.push(params.get(key));conditions.push(key==='mode'?`COALESCE(payload->'enrichment'->>'arrangement',payload->>'mode')=$${args.length}`:`payload->>'${key}'=$${args.length}`);
  }
  const stacks=params.getAll('stack').filter(v=>v!=='All').slice(0,30);
  if(stacks.length){args.push(stacks);conditions.push(`(payload->'tags') ?| $${args.length}::text[]`)}
  for(const key of ['city','seniority'])if(params.get(key)){args.push(key==='city'?'%'+params.get(key).replace(/[\\%_]/g,'\\$&')+'%':params.get(key));conditions.push(key==='city'?`payload->>'location' ILIKE $${args.length}`:`payload->'enrichment'->>'seniority'=$${args.length}`)}
  if(params.get('compensationKnown')==='1')conditions.push(`payload->'enrichment'->'compensation' IS NOT NULL`);
  if(params.get('salaryMin')&&params.get('currency')&&params.get('payPeriod')){args.push(Number(params.get('salaryMin'))||0,params.get('currency'),params.get('payPeriod'));conditions.push(`(payload->'enrichment'->'compensation'->>'max')::numeric >= $${args.length-2} AND payload->'enrichment'->'compensation'->>'currency'=$${args.length-1} AND payload->'enrichment'->'compensation'->>'period'=$${args.length}`)}
  const where=conditions.join(' AND ');
  const newest=isExploreSearch(params)?"payload->>'discovered' DESC,id":'discovered_at DESC,id';
  const recommended=(q?`CASE WHEN payload->>'title' ILIKE $${qIndex} THEN 0 ELSE 1 END,`:"")+"(payload->>'checked')::timestamptz DESC,"+newest;
  const order=sort==='remote'?"(payload->>'mode'='Remote') DESC,"+newest:sort==='newest'?newest:recommended;
  const total=await db.query('SELECT count(*)::int AS total FROM jobs WHERE '+where,args);
  const rows=await db.query(`SELECT payload FROM jobs WHERE ${where} ORDER BY ${order} LIMIT $${args.length+1} OFFSET $${args.length+2}`,[...args,limit,(page-1)*limit]);
  const checks=await db.query('SELECT source,status,matched,checked_at,(SELECT max(completed_at) FROM ingestion_runs r WHERE r.source=source_checks.source) AS last_success FROM source_checks ORDER BY source');
  const last=await db.query('SELECT max(completed_at) AS last FROM ingestion_runs');
  return {jobs:rows.rows.map(row=>({...row.payload,...(resolveCompany(row.payload)?{companyId:resolveCompany(row.payload).id}:{})})),total:total.rows[0].total,page,limit,lastSync:last.rows[0]?.last||null,sources:checks.rows,feedHealth:summarizeFeedHealth(checks.rows,params)};
}

export async function getJob(db,id,{includeUnavailable=false}={}){
  const result=await db.query(`SELECT payload,source_available FROM jobs WHERE active=true AND id=$1 UNION ALL SELECT payload,source_available FROM jobs WHERE active=false AND id=$1 AND (source_available=true${includeUnavailable?' OR true':''}) `,[id]);
  const row=result.rows[0];if(!row)return null;return {...row.payload,availability:row.source_available===true?'available':row.source_available===false?'closed':'unknown'};
}

export function filterSeedJobs(jobs,params=new URLSearchParams()){
  const {page,limit,q,sort}=options(params),query=q.toLowerCase();
  const filtered=jobs.filter(job=>matchesJobSearch(job,params));
  const matches=params.get('collection')==='remote'||isExploreSearch(params)?deduplicateJobs(filtered):filtered;
  matches.sort((a,b)=>{
    if(sort==='remote'){const remote=Number(b.mode==='Remote')-Number(a.mode==='Remote');if(remote)return remote}
    if(sort!=='remote'&&sort!=='newest'){
      const relevance=Number(b.title.toLowerCase().includes(query))-Number(a.title.toLowerCase().includes(query));
      if(query&&relevance)return relevance;
      const verified=Date.parse(b.checked)-Date.parse(a.checked);if(verified)return verified;
    }
    return b.discovered.localeCompare(a.discovered)||String(a.id||'').localeCompare(String(b.id||''));
  });
  return {jobs:matches.slice((page-1)*limit,page*limit),total:matches.length,page,limit,lastSync:null,sources:[],warning:'Showing the curated collection while live data is unavailable.'};
}

export function matchesJobSearch(job,params=new URLSearchParams()){
  const query=(params.get('q')||'').slice(0,100).toLowerCase();
  return (params.get('featured')!=='1'||job.featured!==false)&&matchesExplore(job,params)&&(params.get('collection')==='remote'?!!job.remote&&['worldwide','india'].includes(job.remote.scope)&&(job.enrichment?.arrangement||job.mode)==='Remote':(!isRemoteSource(job.source)||(isExploreSearch(params)&&!!job.remote&&['worldwide','india'].includes(job.remote.scope)&&(job.enrichment?.arrangement||job.mode)==='Remote')))&&
    ['type','mode'].every(key=>!params.get(key)||params.get(key)==='All'||(key==='mode'?(job.enrichment?.arrangement||job.mode):job[key])===params.get(key))&&
    (!params.getAll('stack').filter(s=>s!=='All').length||params.getAll('stack').some(s=>job.tags.includes(s)))&&
    (!params.get('city')||job.location.toLowerCase().includes(params.get('city').toLowerCase()))&&
    (!params.get('seniority')||job.enrichment?.seniority===params.get('seniority'))&&
    (params.get('compensationKnown')!=='1'||!!job.enrichment?.compensation)&&
    (!params.get('salaryMin')||!params.get('currency')||!params.get('payPeriod')||job.enrichment?.compensation?.currency===params.get('currency')&&job.enrichment?.compensation?.period===params.get('payPeriod')&&job.enrichment?.compensation?.max>=Number(params.get('salaryMin')))&&
    [job.title,job.company,job.location,...job.tags].join(' ').toLowerCase().includes(query);
}

export function deduplicateJobs(jobs){
  const seen=new Set();
  const priority=job=>job.source==='community'?2:isRemoteSource(job.source)?1:0;
  return [...jobs].sort((a,b)=>priority(a)-priority(b)||String(a.id||'').localeCompare(String(b.id||''))).filter(job=>{
    if(seen.has(job.url))return false;seen.add(job.url);return true;
  });
}

// Only fixed SQL is returned; query parameter values are never interpolated.
export function collectionCondition(params){
  return params.get('collection')==='remote'
    ? "jobs.payload->'remote'->>'scope' IN ('worldwide','india') AND COALESCE(jobs.payload->'enrichment'->>'arrangement',jobs.payload->>'mode')='Remote'"
    : isExploreSearch(params)?"true":"jobs.source NOT IN ('remoteok:public','wwr:programming','hn:whoishiring')";
}

export async function companyJobCounts(db,params=new URLSearchParams()){
  const args=[],conditions=publicJobConditions(params,args);
  conditions.push(...exploreConditions(params,args));
  const identity=companyIdentitySQL(args);
  const result=await db.query(`SELECT ${identity} AS company_id,count(*)::int AS count FROM jobs WHERE ${conditions.join(' AND ')} GROUP BY company_id`,args);
  return Object.fromEntries(result.rows.filter(row=>row.company_id).map(row=>[row.company_id,row.count]));
}

export function publicJobConditions(params,args){
  const conditions=['jobs.active=true',"NOT (source='community' AND EXISTS(SELECT 1 FROM jobs employer WHERE employer.active=true AND employer.source<>'community' AND employer.canonical_url=jobs.canonical_url))"];
  if(params.get('collection')==='remote'||isExploreSearch(params)){
    conditions.push(collectionCondition(params));
    // Prefer employer records when an aggregator supplies the same canonical application URL.
    args.push(REMOTE_SOURCES);
    conditions.push(`(source<>ALL($${args.length}::text[]) OR (payload->'remote'->>'scope' IN ('worldwide','india') AND COALESCE(payload->'enrichment'->>'arrangement',payload->>'mode')='Remote'))`);
    conditions.push(`NOT (source=ANY($${args.length}::text[]) AND EXISTS(SELECT 1 FROM jobs preferred WHERE preferred.active=true AND preferred.canonical_url=jobs.canonical_url AND preferred.id<>jobs.id AND preferred.payload->'remote'->>'scope' IN ('worldwide','india') AND COALESCE(preferred.payload->'enrichment'->>'arrangement',preferred.payload->>'mode')='Remote' AND (CASE WHEN preferred.source=ANY($${args.length}::text[]) THEN 1 ELSE 0 END,preferred.id)<(1,jobs.id)))`);
  }else{
    conditions.push(collectionCondition(params));
  }
  return conditions;
}
