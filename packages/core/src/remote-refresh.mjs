import {randomUUID} from 'node:crypto';
import {fetchRemoteFeeds} from './remote-sources.mjs';
import {REMOTE_SOURCES} from './remote-eligibility.mjs';
import {ingest} from './ingestion.mjs';

export async function refreshRemoteJobs(db,{fetchImpl=fetch,signal=AbortSignal.timeout(25000)}={}){
  const client=await db.connect();let locked=false;
  try{
    const lock=await client.query("SELECT pg_try_advisory_lock(hashtext('frontlane-remote-refresh')) AS locked");
    if(!lock.rows[0].locked)return {skipped:'Remote refresh already running'};
    locked=true;
    const checked=new Date().toISOString();
    const feeds=await fetchRemoteFeeds({checked,fetchImpl,signal}),sources=[];
    for(const feed of feeds){
      let accepted=0;
      if(feed.status!=='failed'){
        try{
          // Each bounded chunk is additive and replay protected; no external feed can close an employer snapshot.
          await client.query('BEGIN');
          const runId='remote-'+randomUUID();
          for(let offset=0;offset<feed.jobs.length;offset+=100){
            const receipt=await ingest({source:feed.source,runId:runId+'-'+offset,jobs:feed.jobs.slice(offset,offset+100)},db,{client});accepted+=receipt.accepted;
          }
          await client.query('COMMIT');
        }catch(error){await client.query('ROLLBACK');accepted=0;feed.status='failed';feed.error=String(error.message).slice(0,160)}
      }
      await client.query("INSERT INTO source_checks(source,checked_at,status,matched) VALUES($1,now(),$2,$3) ON CONFLICT(source) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,matched=excluded.matched",[feed.source,feed.status,accepted]);
      sources.push({source:feed.source,status:feed.status,matched:accepted,...(feed.error?{error:feed.error}:{})});
    }
    await client.query('BEGIN');
    let expired;
    try{
      await client.query("SELECT pg_advisory_xact_lock(hashtext('frontlane-publication'))");
      expired=await client.query("UPDATE jobs SET active=false,source_available=false,updated_at=now() WHERE source=ANY($1::text[]) AND active=true AND (payload->'remote'->>'lastSeen')::timestamptz < now()-interval '45 days'",[REMOTE_SOURCES]);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error}
    return {sources,expired:expired.rowCount||0};
  }finally{
    let discard=false;
    try{if(locked)await client.query("SELECT pg_advisory_unlock(hashtext('frontlane-remote-refresh'))")}catch{discard=true}
    client.release(discard);
  }
}
