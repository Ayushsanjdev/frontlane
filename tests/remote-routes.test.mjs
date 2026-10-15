import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {discoveryDatabase} from './helpers/discovery-db.mjs';
register('./helpers/route-loader.mjs',import.meta.url);
const cron=await import('../apps/web/app/api/cron/remote-jobs/route.ts');
test('remote refresh requires a cron or ingestion credential before touching the database',async()=>{
  process.env.CRON_SECRET='c'.repeat(32);process.env.INGEST_TOKEN='i'.repeat(32);
  globalThis.__frontlaneRouteTest={db:{connect:()=>assert.fail('must not connect')}};
  assert.equal((await cron.GET(new Request('https://example.com/api/cron/remote-jobs'))).status,401);
});
test('remote cron reports provider failures and releases its independent lock',async()=>{
  const f=await discoveryDatabase();const previous=globalThis.fetch;
  process.env.CRON_SECRET='c'.repeat(32);globalThis.__frontlaneRouteTest={db:f.db};globalThis.fetch=async()=>new Response('',{status:503});
  try{
    for(let i=0;i<2;i++){
      const response=await cron.GET(new Request('https://example.com/api/cron/remote-jobs',{headers:{authorization:'Bearer '+'c'.repeat(32)}}));
      assert.equal(response.status,503);const body=await response.json();assert.equal(body.sources.length,3);assert.equal(body.expired,0);
    }
  }finally{globalThis.fetch=previous;await f.close()}
});

test('recommendation collection filtering happens before the 2000-job limit',async()=>{
  const route=await import('../apps/web/app/api/recommendations/route.ts');
  const f=await discoveryDatabase();
  try{
    await f.db.query('CREATE TABLE job_feedback(user_id text,kind text,target text)');
    await f.db.query('INSERT INTO profiles(user_id,payload) VALUES($1,$2)',['alice',{matchingPreferences:{skills:['React']}}]);
    const job={id:'employer',source:'greenhouse:acme',url:'https://example.com/employer',title:'React Frontend Engineer',company:'Acme',location:'India',mode:'Remote',tags:['React'],type:'Full-time',discovered:'2026-01-01',remote:{scope:'india',evidence:'Remote India',lastSeen:new Date().toISOString()}};
    await f.db.query("INSERT INTO jobs(id,source,canonical_url,payload,discovered_at) VALUES($1,$2,$3,$4,'2020-01-01')",[job.id,job.source,job.url,job]);
    await f.db.query("INSERT INTO jobs(id,source,canonical_url,payload) SELECT 'aggregator'||n,'remoteok:public','https://remoteok.com/jobs/'||n,$1::jsonb||jsonb_build_object('id','aggregator'||n,'source','remoteok:public','url','https://remoteok.com/jobs/'||n) FROM generate_series(1,2000) n",[job]);
    globalThis.__frontlaneRouteTest={db:f.db,user:{userId:'alice'}};
    const response=await route.GET(new Request('https://example.com/api/recommendations'));
    assert.equal(response.status,200);const result=await response.json();assert.equal(result.total,1);assert.equal(result.jobs[0].id,'employer');
    // Reverse discovery priority: remote candidates must also survive a newer employer collection.
    await f.db.query("DELETE FROM jobs WHERE source='remoteok:public'");
    await f.db.query("UPDATE jobs SET source='remoteok:public',payload=payload||'{\"source\":\"remoteok:public\"}'::jsonb");
    await f.db.query("INSERT INTO jobs(id,source,canonical_url,payload) SELECT 'employer'||n,'greenhouse:other','https://example.com/jobs/'||n,($1::jsonb-'remote')||jsonb_build_object('id','employer'||n,'source','greenhouse:other','url','https://example.com/jobs/'||n) FROM generate_series(1,2000) n",[job]);
    const remote=await route.GET(new Request('https://example.com/api/recommendations?collection=remote'));
    assert.equal(remote.status,200);assert.equal((await remote.json()).total,1);
  }finally{await f.close()}
});
