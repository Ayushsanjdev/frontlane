import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ingest} from '@frontlanejobs/core/ingestion';
import {listJobs,filterSeedJobs} from '@frontlanejobs/core/jobs';
import {fetchEmployerFeed} from '@frontlanejobs/core/sources';
import {validateSourceSelection,seedEmployers} from '@frontlanejobs/core/employers';
import {discoveryDatabase} from './helpers/discovery-db.mjs';
const checked=new Date().toISOString();
const base={title:'Frontend Engineer',company:'Example',location:'India',mode:'Remote',type:'Full-time',salary:'Not disclosed',tags:['React'],experience:'1 year',summary:'Build React interfaces.',caveat:'Check employer',url:'https://example.com/jobs/1',checked,posted:null,eligibility:'India',degree:'Review employer'};

test('full snapshots publish all available roles while the selected batch stays featured',async()=>{
  const f=await discoveryDatabase();
  try{
    const jobs=Array.from({length:125},(_,i)=>({...base,requisitionId:String(i),url:'https://example.com/jobs/'+i}));
    const batch={source:'greenhouse:example',runId:'full-inventory-1',jobs:jobs.slice(0,50),availableJobs:jobs,completeSnapshot:true};
    const first=await ingest(batch,f.db);
    assert.equal((await listJobs(f.db,new URLSearchParams('limit=100'))).total,125);
    assert.equal((await listJobs(f.db,new URLSearchParams('featured=1'))).total,50);
    const payloads=(await f.db.query('SELECT payload FROM jobs WHERE active')).rows.map(r=>r.payload);
    assert.equal(filterSeedJobs(payloads,new URLSearchParams('featured=1')).total,50);
    assert.equal((await ingest(batch,f.db)).replayed,true);
    await ingest({source:'research:independent',runId:'independent-1',jobs:[{...base,url:'https://example.com/research'}]},f.db);
    await ingest({...batch,runId:'full-inventory-2',jobs:[],availableJobs:jobs.slice(1)},f.db);
    assert.equal((await f.db.query("SELECT active FROM jobs WHERE source='greenhouse:example' AND canonical_url='https://example.com/jobs/0'")).rows[0].active,false);
    assert.equal((await listJobs(f.db)).total,125);
    assert.equal((await f.db.query("SELECT active FROM jobs WHERE source='research:independent'")).rows[0].active,true);
    assert.equal(first.accepted,50);
    assert.equal((await f.db.query('SELECT count(*)::int AS n FROM job_first_publications')).rows[0].n,126);
    await assert.rejects(ingest({...batch,runId:'invalid-featured',availableJobs:[]},f.db),/Featured roles/);
  }finally{await f.close()}
});

test('public Ashby feeds normalize listed India roles and structured internships',async()=>{
  const rows=[
    {id:'a',title:'Frontend Engineer',location:'Bengaluru, India',isListed:true,isRemote:false,workplaceType:'Hybrid',descriptionPlain:'Build React. 1 year of experience.',employmentType:'FullTime',publishedAt:'2026-01-01T00:00:00Z',jobUrl:'https://jobs.ashbyhq.com/example/a',applyUrl:'https://jobs.ashbyhq.com/example/a/application'},
    {id:'b',title:'Frontend Engineer',location:'New York, USA',secondaryLocations:[{location:'India'}],isListed:true,isRemote:true,workplaceType:'Remote',descriptionPlain:'Work remotely from India. Build React.',employmentType:'Intern',jobUrl:'https://jobs.ashbyhq.com/example/b'},
    {id:'hidden',title:'Frontend Engineer',location:'India',isListed:false,jobUrl:'https://jobs.ashbyhq.com/example/hidden'},
  ];
  const feed=await fetchEmployerFeed(['ashby','example','Example'],checked,{fetchImpl:async url=>{assert.match(String(url),/^https:\/\/api.ashbyhq.com\/posting-api\/job-board\/example/);return Response.json({jobs:rows})}});
  assert.equal(feed.status,undefined,feed.error);assert.equal(feed.jobs.length,2);
  assert.equal(feed.jobs[0].mode,'Hybrid');assert.equal(feed.jobs[1].enrichment.careerStage,'Internship');
  assert.match(feed.jobs[1].location,/India/);assert.equal(feed.jobs[1].remote.scope,'india');
});

test('Explore includes eligible aggregator jobs without changing the main board collection',async()=>{
  const f=await discoveryDatabase();
  try{
    const job={...base,company:'Harness',remote:{scope:'india',evidence:'Remote India',lastSeen:checked}};
    await ingest({source:'remoteok:public',runId:'explore-remote-inclusion',jobs:[job]},f.db);
    assert.equal((await listJobs(f.db)).total,0);
    const params=new URLSearchParams('companyGroup=growth-startups');
    assert.equal((await listJobs(f.db,params)).total,1);
    const payloads=(await f.db.query('SELECT payload FROM jobs')).rows.map(r=>r.payload);
    assert.equal(filterSeedJobs(payloads,params).total,1);
  }finally{await f.close()}
});

test('provider migration and registry accept verified Ashby and fixed Amazon sources',async()=>{
  assert.doesNotThrow(()=>validateSourceSelection({sources:[['ashby','example','Example'],['amazon','amazon','Amazon']],deferred:0,rotation:0}));
  const f=await discoveryDatabase();
  try{
    await f.pg.exec(await readFile(new URL('../packages/database/schema/011-expanded-feeds.sql',import.meta.url),'utf8'));
    await seedEmployers(f.db);
    const sources=(await f.db.query("SELECT provider FROM employer_sources WHERE provider IN ('ashby','amazon')")).rows;
    assert.ok(sources.some(r=>r.provider==='ashby'));assert.ok(sources.some(r=>r.provider==='amazon'));
  }finally{await f.close()}
});

test('Amazon pages official India search results and preserves source qualifications',async()=>{
  const calls=[];
  const feed=await fetchEmployerFeed(['amazon','amazon','Amazon'],checked,{fetchImpl:async input=>{
    const url=new URL(input);assert.equal(url.origin,'https://www.amazon.jobs');calls.push(url.searchParams.get('base_query'));
    return Response.json({hits:1,jobs:[{id_icims:'123',title:'Front-End Engineer',country_code:'IND',city:'Bengaluru',state:'KA',job_path:'/en/jobs/123/front-end-engineer',description:'Build React interfaces.',basic_qualifications:'2+ years of experience',posted_date:'January 1, 2026',locations:[],job_schedule_type:'full-time'}]});
  }});
  assert.equal(feed.status,undefined,feed.error);assert.equal(feed.jobs.length,1);assert.equal(feed.jobs[0].company,'Amazon');
  assert.equal(feed.jobs[0].url,'https://www.amazon.jobs/en/jobs/123/front-end-engineer');assert.match(feed.jobs[0].enrichment.description,/2\+ years/);
  assert.deepEqual(calls,['front end','frontend','UI engineer']);
  const failed=await fetchEmployerFeed(['amazon','amazon','Amazon'],checked,{fetchImpl:async()=>Response.json({hits:2,jobs:[]})});
  assert.equal(failed.status,'failed');
});

test('every seeded employer has an exact company group mapping',async()=>{
  const {SOURCES}=await import('@frontlanejobs/core/sources');const {resolveCompany}=await import('@frontlanejobs/database/companies');
  for(const [provider,slug,company] of SOURCES)assert.ok(resolveCompany({source:provider+':'+slug.toLowerCase(),company}),provider+':'+slug);
});

test('India feed eligibility rejects US substring matches and fallback rejects contradictory remote records',async()=>{
  const {eligible}=await import('@frontlanejobs/core/sources');
  assert.equal(eligible('Frontend Engineer','Indianapolis, US','Build React'),false);
  const bad={...base,source:'remoteok:public',company:'Harness',mode:'Onsite',id:'bad',discovered:'2026-10-15',remote:{scope:'india',evidence:'India',lastSeen:checked}};
  assert.equal(filterSeedJobs([bad],new URLSearchParams('companyGroup=growth-startups')).total,0);
});

test('feed health distinguishes successful checks, failures and first-check pending sources',async()=>{
  const {summarizeFeedHealth}=await import('../packages/core/src/feed-health.mjs');
  const value=summarizeFeedHealth([
    {source:'amazon:amazon',status:'failed',checked_at:'2026-10-15T12:00:00Z',last_success:'2026-10-15T04:00:00Z'},
    {source:'remoteok:public',status:'ok',checked_at:'2026-10-15T06:00:00Z'},
    {source:'research:manual',status:'ok',checked_at:'2026-10-15T14:00:00Z'},
  ],new URLSearchParams('companyGroup=faang'));
  assert.equal(value.configured,4);assert.equal(value.healthy,1);assert.equal(value.failed,1);assert.equal(value.pending,2);
  assert.equal(value.lastSuccess,'2026-10-15T06:00:00.000Z');assert.equal(value.lastAttempt,'2026-10-15T12:00:00.000Z');
});
