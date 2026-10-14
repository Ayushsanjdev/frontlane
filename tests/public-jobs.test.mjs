import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {discoveryDatabase} from './helpers/discovery-db.mjs';
import {publishPublicJob} from '../packages/core/src/public-jobs.mjs';
import {listJobs} from '@frontlanejobs/core/jobs';
import {ingest} from '@frontlanejobs/core/ingestion';

export const publicPost=(patch={})=>({submissionId:randomUUID(),title:'Frontend Engineer',company:'Example Co',location:'Bengaluru, India',mode:'Hybrid',type:'Full-time',url:'https://example.com/careers/frontend',summary:'Build accessible frontend interfaces with React and TypeScript for our product team.',tags:['React','TypeScript'],...patch});

test('a signed-in member publishes a public job without exposing their identity or marking it verified',async()=>{
  const f=await discoveryDatabase();
  try{
    const result=await publishPublicJob(f.db,'google:private-user',publicPost());
    assert.equal(result.job.source,'community');assert.equal(result.job.company,'Example Co');
    assert.equal(result.job.posted,null);assert.match(result.job.caveat,/Community/);
    assert.doesNotMatch(JSON.stringify(result),/private-user|submissionId/);
    const collection=await listJobs(f.db,new URLSearchParams({q:'Example Co'}));
    assert.equal(collection.total,1);assert.equal(collection.jobs[0].id,result.job.id);
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM applications')).rows[0].count,0);
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM source_checks')).rows[0].count,0);
  }finally{await f.close()}
});

test('retries are idempotent and other members cannot overwrite or duplicate a public listing',async()=>{
  const f=await discoveryDatabase();
  try{
    const input=publicPost(),first=await publishPublicJob(f.db,'alice',input);
    const retry=await publishPublicJob(f.db,'alice',input);
    assert.equal(retry.replayed,true);assert.equal(retry.job.id,first.job.id);
    await assert.rejects(publishPublicJob(f.db,'alice',{...input,company:'Changed'}),error=>error.status===409);
    await assert.rejects(publishPublicJob(f.db,'bob',publicPost({url:input.url+'?utm_source=duplicate'})),error=>error.status===409);
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM jobs')).rows[0].count,1);
    assert.equal((await f.db.query('SELECT owner_id FROM job_publications')).rows[0].owner_id,'alice');
  }finally{await f.close()}
});

test('public publishing rejects malformed fields, spoofed metadata, and ineligible roles',async()=>{
  const f=await discoveryDatabase();
  try{
    for(const patch of [{url:'javascript:alert(1)'},{summary:'short'},{source:'greenhouse:fake'},{checked:new Date().toISOString()},{title:'Backend Engineer'},{location:'US only'},{company:'   '},{tags:['x'.repeat(41)]}]){
      await assert.rejects(publishPublicJob(f.db,'alice',publicPost(patch)));
    }
    await assert.rejects(publishPublicJob(f.db,'',publicPost()));
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM jobs')).rows[0].count,0);
  }finally{await f.close()}
});

test('publication limits are per member and concurrent attempts cannot exceed the daily limit',async()=>{
  const f=await discoveryDatabase();
  try{
    const results=await Promise.allSettled(Array.from({length:12},(_,i)=>publishPublicJob(f.db,'alice',publicPost({url:'https://example.com/jobs/'+i}))));
    assert.equal(results.filter(row=>row.status==='fulfilled').length,10);
    assert.ok(results.filter(row=>row.status==='rejected').every(row=>row.reason.status===429));
    await publishPublicJob(f.db,'bob',publicPost({url:'https://example.com/jobs/bob'}));
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM jobs')).rows[0].count,11);
  }finally{await f.close()}
});

test('a later ATS snapshot takes display priority without deleting the community publication',async()=>{
  const f=await discoveryDatabase();
  try{
    const result=await publishPublicJob(f.db,'alice',publicPost());
    const {id,source,discovered,...job}=result.job;
    await ingest({source:'greenhouse:example',runId:'ats-public-overlap',jobs:[{...job,requisitionId:'123'}],completeSnapshot:true},f.db);
    const collection=await listJobs(f.db);
    assert.equal(collection.total,1);assert.equal(collection.jobs[0].source,'greenhouse:example');
    assert.equal((await f.db.query('SELECT active FROM jobs WHERE id=$1',[id])).rows[0].active,true);
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM job_publications')).rows[0].count,1);
    await assert.rejects(publishPublicJob(f.db,'bob',publicPost()),error=>error.status===409);
  }finally{await f.close()}
});

test('a database uniqueness race returns a conflict and rolls back the new job',async()=>{
  const f=await discoveryDatabase();
  const db={...f.db,connect:async()=>{
    const client=await f.db.connect();
    return {release:()=>client.release(),query:async(sql,args)=>{
      if(sql.startsWith('INSERT INTO job_publications'))throw Object.assign(new Error('concurrent submission'),{code:'23505'});
      return client.query(sql,args);
    }};
  }};
  try{
    await assert.rejects(publishPublicJob(db,'alice',publicPost()),error=>error.status===409);
    assert.equal((await f.db.query('SELECT count(*)::int AS count FROM jobs')).rows[0].count,0);
  }finally{await f.close()}
});
