function options(params){
  const number=(key,fallback,max)=>Math.min(max,Math.max(1,Math.floor(Number(params.get(key))||fallback)));
  return {page:number('page',1,200),limit:number('limit',20,100),q:(params.get('q')||'').slice(0,100),sort:params.get('sort')||'recommended'};
}

export async function listJobs(db,params=new URLSearchParams()){
  const {page,limit,q,sort}=options(params);
  const conditions=['active=true'],args=[];
  if(q){
    args.push('%'+q.replace(/[\\%_]/g,'\\$&')+'%');
    conditions.push(`concat_ws(' ',payload->>'title',payload->>'company',payload->>'location',COALESCE(payload->'tags','[]'::jsonb)::text) ILIKE $1`);
  }
  for(const key of ['type','mode'])if(params.get(key)&&params.get(key)!=='All'){
    args.push(params.get(key));conditions.push(`payload->>'${key}'=$${args.length}`);
  }
  if(params.get('stack')&&params.get('stack')!=='All'){
    args.push(params.get('stack'));conditions.push(`(payload->'tags') ? $${args.length}`);
  }
  const where=conditions.join(' AND ');
  const newest='discovered_at DESC,id';
  const recommended=(q?"CASE WHEN payload->>'title' ILIKE $1 THEN 0 ELSE 1 END,":"")+"(payload->>'checked')::timestamptz DESC,"+newest;
  const order=sort==='remote'?"(payload->>'mode'='Remote') DESC,"+newest:sort==='newest'?newest:recommended;
  const total=await db.query('SELECT count(*)::int AS total FROM jobs WHERE '+where,args);
  const rows=await db.query(`SELECT payload FROM jobs WHERE ${where} ORDER BY ${order} LIMIT $${args.length+1} OFFSET $${args.length+2}`,[...args,limit,(page-1)*limit]);
  const checks=await db.query('SELECT source,status,matched,checked_at FROM source_checks ORDER BY source');
  const last=await db.query('SELECT max(completed_at) AS last FROM ingestion_runs');
  return {jobs:rows.rows.map(row=>row.payload),total:total.rows[0].total,page,limit,lastSync:last.rows[0]?.last||null,sources:checks.rows};
}

export async function getJob(db,id){
  const result=await db.query('SELECT payload FROM jobs WHERE active=true AND id=$1',[id]);
  return result.rows[0]?.payload||null;
}

export function filterSeedJobs(jobs,params=new URLSearchParams()){
  const {page,limit,q,sort}=options(params),query=q.toLowerCase();
  const matches=jobs.filter(job=>
    ['type','mode'].every(key=>!params.get(key)||params.get(key)==='All'||job[key]===params.get(key))&&
    (!params.get('stack')||params.get('stack')==='All'||job.tags.includes(params.get('stack')))&&
    [job.title,job.company,job.location,...job.tags].join(' ').toLowerCase().includes(query)
  );
  matches.sort((a,b)=>{
    if(sort==='remote'){const remote=Number(b.mode==='Remote')-Number(a.mode==='Remote');if(remote)return remote}
    if(sort!=='remote'&&sort!=='newest'){
      const relevance=Number(b.title.toLowerCase().includes(query))-Number(a.title.toLowerCase().includes(query));
      if(query&&relevance)return relevance;
      const verified=Date.parse(b.checked)-Date.parse(a.checked);if(verified)return verified;
    }
    return b.discovered.localeCompare(a.discovered)||a.id.localeCompare(b.id);
  });
  return {jobs:matches.slice((page-1)*limit,page*limit),total:matches.length,page,limit,lastSync:null,sources:[],warning:'Showing the curated collection while live data is unavailable.'};
}
