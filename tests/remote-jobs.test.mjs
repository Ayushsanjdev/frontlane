import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyRemote} from '../packages/core/src/remote-eligibility.mjs';
import {matchesJobSearch,listJobs,filterSeedJobs} from '@frontlanejobs/core/jobs';
import {normalizeSearchCriteria} from '@frontlanejobs/core/job-alerts';
import {JobInput,ingest} from '@frontlanejobs/core/ingestion';
import {discoveryDatabase} from './helpers/discovery-db.mjs';

const checked='2026-10-15T00:00:00.000Z';
const base={title:'Frontend Engineer',company:'Acme',location:'India',mode:'Remote',type:'Full-time',salary:'Not disclosed',tags:['React'],experience:'See listing',summary:'Build React interfaces remotely.',caveat:'Check source',url:'https://example.com/jobs/1',checked,posted:null,eligibility:'India',degree:'See listing'};
const metadata=classifyRemote({location:'Worldwide',description:'Fully remote.',arrangement:'Remote',checked});

test('remote eligibility requires explicit geography and arrangement, preserves evidence and timezone',()=>{
  for(const location of ['Worldwide','Anywhere in the world','India','Remote - India','India, Singapore']){
    const result=classifyRemote({location,description:'Fully remote. Requires 4 hours overlap with CET.',arrangement:'Remote',checked});
    assert.ok(result,location);assert.equal(result.scope,location.includes('India')?'india':'worldwide');assert.match(result.evidence,/India|Worldwide|Anywhere/);assert.match(result.timezone,/CET/);
  }
  for(const [location,description,arrangement] of [
    ['Remote','Build interfaces','Remote'],['USA','Fully remote','Remote'],['Worldwide','Must be based in the US','Remote'],
    ['Worldwide','US residents only','Remote'],['Worldwide','Not hiring in India','Remote'],['India','Hybrid: two days in office','Remote'],
    ['India','Remote optional','Hybrid'],['India','Office-based in Bengaluru','Remote'],['Europe','Remote','Remote'],
    ['Worldwide','Remote within the United States','Remote'],['Worldwide','This role is only open to candidates in Canada','Remote'],
    ['Worldwide','Remote worldwide. Applicants must be authorized to work in the United States.','Remote'],
    ['Worldwide','Remote worldwide. We cannot hire outside the United States.','Remote'],
    ['Remote','We are a remote team with customers worldwide.','Remote'],
    ['Remote','Candidates in India use our product.','Remote'],
    ['Worldwide','Applicants must reside in Brazil','Remote'],['Worldwide','We can only hire in Japan','Remote'],['Worldwide','India is not eligible for this role','Remote'],
  ])assert.equal(classifyRemote({location,description,arrangement,checked}),null,description+' '+location);
});

test('remote metadata validates and collection filters agree in SQL and fallback',async()=>{
  const {db,close}=await discoveryDatabase();
  try{
    const jobs=[{...base,remote:metadata},{...base,url:'https://example.com/jobs/2',mode:'Hybrid'}, {...base,url:'https://example.com/jobs/3'}];
    const aggregator={...base,url:'https://remoteok.com/remote-jobs/123',remote:{...metadata,sourceName:'Remote OK',sourceUrl:'https://remoteok.com/remote-jobs/123'}};
    await ingest({source:'greenhouse:acme',runId:'remote-test-1',jobs},db);
    await ingest({source:'remoteok:public',runId:'remote-test-2',jobs:[aggregator]},db);
    const params=new URLSearchParams('collection=remote');
    assert.equal((await listJobs(db,params)).total,2);
    assert.equal((await listJobs(db)).total,3);
    const payloads=(await db.query('SELECT payload FROM jobs')).rows.map(r=>r.payload);
    assert.equal(filterSeedJobs(payloads,params).total,2);
    assert.equal(filterSeedJobs(payloads).total,3);
    assert.equal(matchesJobSearch({...base,remote:metadata},params),true);
    assert.equal(matchesJobSearch(base,params),false);
    assert.equal(matchesJobSearch({...base,mode:'Hybrid',remote:metadata},params),false);
    assert.equal(normalizeSearchCriteria('collection=remote&q=React'),'collection=remote&q=React');
    assert.equal(normalizeSearchCriteria('collection=garbage'),'');
    await assert.rejects(ingest({source:'remoteok:public',runId:'future-remote',jobs:[{...base,remote:{...metadata,lastSeen:'2100-01-01T00:00:00Z'}}]},db),/Future/);
    assert.throws(()=>JobInput.parse({...base,remote:{...metadata,sourceUrl:'javascript:alert(1)'}}));
  }finally{await close()}
});

test('remote SQL search, pagination and exact URL preference match fallback behavior',async()=>{
  const {db,close}=await discoveryDatabase();
  try{
    const jobs=Array.from({length:3},(_,i)=>({...base,requisitionId:'role'+i,url:'https://example.com/role'+i,title:i===2?'Vue Developer':'React Frontend Engineer',remote:metadata}));
    await ingest({source:'greenhouse:acme',runId:'remote-query-1',jobs},db);
    await ingest({source:'hn:whoishiring',runId:'remote-query-2',jobs:[{...jobs[0],requisitionId:'hn0',remote:{...metadata,sourceName:'Hacker News',sourceUrl:'https://news.ycombinator.com/item?id=1'}}]},db);
    const payloads=(await db.query('SELECT payload FROM jobs')).rows.map(r=>r.payload);
    for(const query of ['collection=remote&q=React&limit=1&page=2','collection=remote&stack=React&type=Full-time','collection=remote&sort=newest','q=React']){
      const params=new URLSearchParams(query),actual=await listJobs(db,params),fallback=filterSeedJobs(payloads,params);
      assert.equal(actual.total,fallback.total,query);assert.equal(actual.jobs.length,fallback.jobs.length,query);
      assert.ok(actual.jobs.every(job=>job.source==='greenhouse:acme'));
    }
    await assert.rejects(ingest({source:'remoteok:public',runId:'remote-snapshot',jobs:[],completeSnapshot:true},db),/Snapshot replacement/);
  }finally{await close()}
});
