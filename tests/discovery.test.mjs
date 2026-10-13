import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discoveryDatabase} from './helpers/discovery-db.mjs';
import {runDiscovery,discoveryQuery} from '../packages/core/src/discovery.mjs';
import {registeredSources,upsertCandidate} from '../packages/core/src/employers.mjs';
import {refreshSources} from '@frontlanejobs/core/sources';
import {ingest} from '@frontlanejobs/core/ingestion';
import {searchAllowance} from '../packages/core/src/discovery-budget.mjs';

export async function discoveryFixture(input,options){
  const url=new URL(input);
  if(url.hostname==='api.search.brave.com'){
    assert.equal(options.headers['X-Subscription-Token'],'fixture-key');
    assert.equal(url.searchParams.get('count'),'20');
    return Response.json({web:{results:[{url:'https://job-boards.greenhouse.io/newco/jobs/1'},{url:'https://job-boards.greenhouse.io/newco/jobs/2'},{url:'https://attacker.example/bad'}]}});
  }
  if(url.hostname==='boards-api.greenhouse.io')return Response.json(url.pathname==='/v1/boards/newco'?{name:'New Company'}:{jobs:url.pathname==='/v1/boards/newco/jobs'?[{id:1,title:'Frontend Engineer',location:{name:'India'},content:'React TypeScript',absolute_url:'https://job-boards.greenhouse.io/newco/jobs/1'}]:[]});
  if(url.hostname==='api.lever.co')return Response.json([]);
  if(url.hostname==='api.smartrecruiters.com')return Response.json({content:[],totalFound:0});
  throw Error('Unexpected fixture host');
}

test('Brave discovery registers an employer and its next refresh publishes a verified job',async()=>{
  const f=await discoveryDatabase();
  try{
    const summary=await runDiscovery(f.db,{apiKey:'fixture-key',fetchImpl:discoveryFixture});
    assert.equal(summary.searchesReserved,2);assert.equal(summary.searchesSucceeded,2);assert.equal(summary.candidatesAdded,1);assert.equal(summary.registered,1);
    assert.doesNotMatch(JSON.stringify(summary),/fixture-key|attacker/);
    const {sources}=await registeredSources(f.db);
    await refreshSources(batch=>ingest(batch,f.db),{sources,fetchImpl:discoveryFixture});
    const jobs=(await f.db.query("SELECT payload FROM jobs WHERE active AND source='greenhouse:newco'")).rows;
    assert.equal(jobs.length,1);assert.equal(jobs[0].payload.company,'New Company');assert.equal(jobs[0].payload.posted,null);
  }finally{await f.close()}
});

test('failed searches consume allowance, missing keys do not, and query progress resumes',async()=>{
  const f=await discoveryDatabase();
  try{
    const missing=await runDiscovery(f.db,{});
    assert.equal(missing.status,'missing-key');assert.equal((await searchAllowance(f.db)).dayUsed,0);
    const queries=[];
    const failedFetch=async input=>{queries.push(new URL(input).searchParams.get('q'));return new Response('rate limited',{status:429})};
    const first=await runDiscovery(f.db,{apiKey:'fixture-key',fetchImpl:failedFetch});
    assert.equal(first.searchesReserved,2);assert.equal(first.searchesSucceeded,0);
    const second=await runDiscovery(f.db,{apiKey:'fixture-key',fetchImpl:failedFetch});
    assert.equal(second.searchesReserved,2);assert.equal((await searchAllowance(f.db)).dayUsed,4);
    assert.equal(new Set(queries).size,4);
    assert.notDeepEqual(discoveryQuery(0),discoveryQuery(1));
  }finally{await f.close()}
});

test('exhausted budgets still verify queued work and occupied leases skip all network access',async()=>{
  const f=await discoveryDatabase();
  try{
    await f.db.query("INSERT INTO discovery_requests(id,reserved_at,query_index) SELECT md5(n::text)::uuid,now(),n FROM generate_series(1,30) n");
    await upsertCandidate(f.db,{source:'greenhouse:newco',provider:'greenhouse',slug:'newco',boardUrl:'https://job-boards.greenhouse.io/newco',query:'fixture'});
    const summary=await runDiscovery(f.db,{apiKey:'fixture-key',fetchImpl:discoveryFixture});
    assert.equal(summary.searchesReserved,0);assert.equal(summary.registered,1);
    await f.db.query("UPDATE discovery_state SET lease_token='00000000-0000-4000-8000-000000000001',lease_expires_at=now()+interval '1 minute'");
    const busy=await runDiscovery(f.db,{apiKey:'fixture-key',fetchImpl:()=>assert.fail('no network permitted')});
    assert.equal(busy.status,'busy');
  }finally{await f.close()}
});

test('deadline and malformed search responses never register unverified candidates',async()=>{
  const f=await discoveryDatabase();
  try{
    const expired=await runDiscovery(f.db,{apiKey:'fixture-key',timeoutMs:1,fetchImpl:()=>assert.fail('must not start work')});
    assert.equal(expired.searchesReserved,0);
    const malformed=await runDiscovery(f.db,{apiKey:'fixture-key',fetchImpl:async()=>Response.json({unexpected:[]})});
    assert.equal(malformed.registered,0);assert.equal(malformed.failed,2);assert.equal(malformed.searchesReserved,2);
  }finally{await f.close()}
});
