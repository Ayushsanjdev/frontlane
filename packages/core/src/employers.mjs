import {randomUUID} from 'node:crypto';
import {SOURCES} from './sources.mjs';
import {discoveryTransaction} from './discovery-store.mjs';

export async function seedEmployers(db){
  for(const [provider,slug,company] of SOURCES){
    await db.query("INSERT INTO employer_sources(source,provider,slug,company,origin,verified_at) VALUES($1,$2,$3,$4,'seeded',now()) ON CONFLICT DO NOTHING",[provider+':'+slug.toLowerCase(),provider,slug,company]);
  }
}

export async function upsertCandidate(db,candidate,{now=new Date()}={}){
  const result=await db.query(`INSERT INTO discovery_candidates(source,provider,slug,board_url,query,discovered_at,next_attempt_at)
    SELECT $1,$2,$3,$4,$5,$6,$6 WHERE NOT EXISTS(SELECT 1 FROM employer_sources WHERE source=$1)
    ON CONFLICT DO NOTHING RETURNING source`,[candidate.source,candidate.provider,candidate.slug,candidate.boardUrl,candidate.query.slice(0,500),now]);
  return {inserted:result.rows.length>0};
}

export async function claimCandidates(db,{now=new Date(),limit=4,leaseMs=60000}={}){
  const token=randomUUID();
  const result=await db.query(`WITH due AS (
    SELECT source FROM discovery_candidates WHERE status<>'verified' AND next_attempt_at<=$1
    AND (lease_expires_at IS NULL OR lease_expires_at<=$1)
    ORDER BY next_attempt_at,discovered_at,source FOR UPDATE SKIP LOCKED LIMIT $2
  ) UPDATE discovery_candidates c SET lease_token=$3,lease_expires_at=$4,attempts=attempts+1
  FROM due WHERE c.source=due.source RETURNING c.*`,[now,limit,token,new Date(now.getTime()+leaseMs)]);
  return result.rows;
}

export async function recordVerification(db,candidate,result,{now=new Date()}={}){
  return discoveryTransaction(db,async client=>{
    const current=await client.query('SELECT * FROM discovery_candidates WHERE source=$1 AND lease_token=$2 AND lease_expires_at>$3 FOR UPDATE',[candidate.source,candidate.lease_token,now]);
    if(!current.rows.length)return {registered:false};
    const status=result.status==='verified'&&typeof result.company==='string'&&result.company.trim()&&result.company.length<=120&&result.matched>0?'verified':result.status==='verified'?'pending':result.status;
    const delay=status==='no-match'?7*86400000:status==='failed'?Math.min(86400000,60000*2**Math.min(current.rows[0].attempts,10)):86400000;
    await client.query('UPDATE discovery_candidates SET status=$2,company=$3,matched=$4,error=$5,next_attempt_at=$6,lease_token=NULL,lease_expires_at=NULL WHERE source=$1',[candidate.source,status,result.company||null,result.matched||0,result.error?.slice(0,160)||null,new Date(now.getTime()+delay)]);
    if(status!=='verified')return {registered:false};
    const inserted=await client.query(`INSERT INTO employer_sources(source,provider,slug,company,origin,verified_at)
      VALUES($1,$2,$3,$4,'discovered',$5) ON CONFLICT DO NOTHING RETURNING source`,[candidate.source,candidate.provider,candidate.slug,result.company.trim(),now]);
    return {registered:inserted.rows.length>0};
  });
}

export async function registeredSources(db,{now=new Date(),discoveredLimit=20}={}){
  const seeds=await db.query("SELECT provider,slug,company FROM employer_sources WHERE origin='seeded' ORDER BY source");
  const found=await db.query("SELECT provider,slug,company FROM employer_sources WHERE origin='discovered' AND verified_at IS NOT NULL ORDER BY last_attempt_at NULLS FIRST,source LIMIT $1",[discoveredLimit]);
  const count=await db.query("SELECT count(*)::int AS count FROM employer_sources WHERE origin='discovered' AND verified_at IS NOT NULL");
  const trusted=seeds.rows.length?seeds.rows:SOURCES.map(([provider,slug,company])=>({provider,slug,company}));
  return {sources:[...trusted,...found.rows].map(r=>[r.provider,r.slug,r.company]),deferred:Math.max(0,(count.rows[0]?.count||0)-found.rows.length),rotation:Math.floor(now.getTime()/86400000)};
}

export async function markEmployerChecks(db,outcomes,{now=new Date()}={}){
  for(const row of outcomes)await db.query('UPDATE employer_sources SET last_attempt_at=$2,last_status=$3 WHERE source=$1',[row.source,now,row.status||'attempted']);
}

export async function discoveryPublicSummary(db){
  const last=await db.query('SELECT completed_at,status,summary FROM discovery_runs WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1');
  const count=await db.query("SELECT count(*)::int AS count FROM employer_sources WHERE origin='discovered' AND verified_at IS NOT NULL");
  const row=last.rows[0];
  return {registeredEmployers:count.rows[0]?.count||0,lastRun:row?{completedAt:row.completed_at,status:row.status,registered:Number(row.summary.registered)||0,verified:Number(row.summary.verified)||0}:null};
}
