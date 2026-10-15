import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveCompany,recentFunding,companies} from '../packages/database/src/company-catalog.mjs';
import {isFresher} from '../packages/core/src/explore.mjs';
import {listJobs,filterSeedJobs} from '@frontlanejobs/core/jobs';
import {ingest} from '@frontlanejobs/core/ingestion';
import {normalizeSearchCriteria} from '@frontlanejobs/core/job-alerts';
import {enrichJob} from '@frontlanejobs/core/job-enrichment';
import {discoveryDatabase} from './helpers/discovery-db.mjs';

const checked=new Date().toISOString();
const base={title:'Frontend Engineer',company:'Harness',location:'Bengaluru, India',mode:'Onsite',type:'Full-time',salary:'Not disclosed',tags:['React'],experience:'See employer requirements',summary:'Build interfaces.',caveat:'Check employer',url:'https://example.com/jobs/1',checked,posted:null,eligibility:'India',degree:'Review requirements'};

test('company identity uses exact aliases and source identity, never fuzzy matches',()=>{
  assert.equal(resolveCompany({company:' Google '})?.id,'google');
  assert.equal(resolveCompany({company:'Google consultancy'}),null);
  assert.equal(resolveCompany({company:'Google',source:'greenhouse:harnessinc'})?.id,'harness');
  assert.equal(resolveCompany({company:'Unknown',companyId:'google'}),null);
  assert.ok(companies.find(c=>c.id==='google').groups.includes('big-tech'));
});

test('funding uses announcement dates, clamps leap years and excludes future records',()=>{
  const company={funding:[{announced:'2024-02-29',sourceUrl:'https://example.com/a'},{announced:'2025-03-01',sourceUrl:'https://example.com/b'}]};
  assert.equal(recentFunding(company,new Date('2025-02-28T23:59:00Z'))?.announced,'2024-02-29');
  assert.equal(recentFunding(company,new Date('2025-03-01T00:00:00Z'))?.announced,'2025-03-01');
  assert.equal(recentFunding({funding:[{announced:'2024-02-28'}]},new Date('2025-03-01')),null);
  assert.equal(recentFunding({funding:[{announced:'2026-01-01'}]},new Date('2025-03-01')),null);
});

test('freshers exclude unknown and conflicting senior requirements',()=>{
  for(const [changes,want] of [
    [{title:'Frontend Intern'},true], [{title:'Graduate Frontend Engineer'},true],
    [{experience:'Freshers welcome'},true], [{experience:'0–3 years'},true], [{experience:'1–5 years'},true], [{experience:'0–1 years'},true], [{experience:'1+ years of experience'},true],
    [{experience:'2+ years'},false], [{title:'Frontend Intern',experience:'3+ yrs'},false], [{title:'Frontend Intern',experience:'three years of experience'},false], [{},false],
    [{title:'Senior Frontend Intern'},false],
    [{title:'Frontend Intern',enrichment:{description:'Requires 3 years of professional experience.',arrangement:'Onsite'}},false],
    [{title:'Graduate Frontend Engineer',enrichment:{yearsMin:4,description:'',arrangement:'Onsite'}},false],
    [{experience:'0–1 years',summary:'Requires 3 years of React experience.'},false],
  ])assert.equal(isFresher({...base,...changes}),want,JSON.stringify(changes));
  assert.equal(enrichJob({title:'Frontend Intern',description:'Build interfaces.'}).careerStage,'Internship');
});

test('SQL and fallback agree for company, fresher, geography, funding and pagination filters',async t=>{
  t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-15T12:00:00Z')});
  const fixed={...base,checked:'2026-10-14T00:00:00Z'};
  const {db,close}=await discoveryDatabase();
  try{
    await ingest({source:'greenhouse:harnessinc',runId:'explore-harness-1',jobs:[
      {...fixed,title:'Frontend Intern'}, {...fixed,url:'https://example.com/jobs/2',title:'Senior Frontend Engineer',experience:'5 years'},
      {...fixed,url:'https://example.com/jobs/3',experience:'0–1 years'},
      {...fixed,url:'https://example.com/jobs/4',title:'Graduate Frontend Engineer',experience:'3 years'},
      {...fixed,url:'https://example.com/jobs/5',title:'Frontend Intern',location:'United States'},
    ]},db);
    await ingest({source:'research:google',runId:'explore-google-1',jobs:[{...fixed,company:'Google',title:'Frontend Intern',url:'https://example.com/jobs/google'}]},db);
    const payloads=(await db.query('SELECT payload FROM jobs')).rows.map(r=>r.payload);
    for(const [query,total] of [
      ['companyGroup=faang',1],['companyGroup=big-tech&freshers=1',1],['companyGroup=growth-startups&freshers=1',2],
      ['freshers=1',3],['companyGroup=growth-startups&freshers=1&q=Frontend',2],['companyGroup=growth-startups&stack=React&city=Bengaluru&seniority=Senior',0],['companyGroup=unknown',0],['companyId=google',1],
      ['freshers=1&limit=1&page=2',3],['recentlyFunded=1&freshers=1',2],
    ]){
      const params=new URLSearchParams(query),sql=await listJobs(db,params),fallback=filterSeedJobs(payloads,params);
      assert.equal(sql.total,total,query);assert.equal(fallback.total,total,query);
      assert.deepEqual(sql.jobs.map(j=>j.id),fallback.jobs.map(j=>j.id),query);
    }
    assert.equal(payloads.find(j=>j.company==='Google').companyId,'google');
    assert.equal(normalizeSearchCriteria('companyGroup=faang&freshers=1&recentlyFunded=1&companyId=google&collection=remote&page=4'),'collection=remote&companyGroup=faang&companyId=google&freshers=1&recentlyFunded=1');
  }finally{await close()}
});

test('Explore rejects US locations whose names contain India as a substring',async()=>{
  const {db,close}=await discoveryDatabase();
  try{
    await ingest({source:'research:us',runId:'explore-us-locations',jobs:['Indianapolis, US','Indiana, United States'].map((location,i)=>({...base,company:'Google',location,title:'Frontend Intern',url:'https://example.com/us/'+i}))},db);
    const payloads=(await db.query('SELECT payload FROM jobs')).rows.map(r=>r.payload),params=new URLSearchParams('companyGroup=faang');
    assert.equal(filterSeedJobs(payloads,params).total,0);assert.equal((await listJobs(db,params)).total,0);
  }finally{await close()}
});

test('company counts deduplicate remote aggregator copies like the jobs board',async()=>{
  const {companyJobCounts}=await import('@frontlanejobs/core/jobs');
  const {db,close}=await discoveryDatabase();
  try{
    const remote={scope:'india',evidence:'Remote India',lastSeen:checked};
    const job={...base,title:'Frontend Intern',mode:'Remote',remote};
    await ingest({source:'greenhouse:harnessinc',runId:'explore-count-employer',jobs:[job]},db);
    await ingest({source:'remoteok:public',runId:'explore-count-remote',jobs:[job]},db);
    const params=new URLSearchParams('collection=remote&companyGroup=growth-startups');
    assert.equal((await listJobs(db,params)).total,1);
    assert.deepEqual(await companyJobCounts(db,params),{harness:1});
  }finally{await close()}
});

test('collection parameters pin the selected group and preserve independent remote and search filters',async()=>{
  const {exploreParameters}=await import('@frontlanejobs/core/explore');
  const params=exploreParameters('faang',new URLSearchParams('companyGroup=services&companyId=other&freshers=1&recentlyFunded=1&q=React&collection=remote&mode=Hybrid&city=Pune&limit=100'));
  assert.equal(params.get('companyGroup'),'faang');assert.equal(params.get('q'),'React');assert.equal(params.get('collection'),'remote');
  for(const key of ['companyId','freshers','recentlyFunded','limit','city','mode'])assert.equal(params.has(key),false,key);
  assert.equal(exploreParameters('invalid'),null);
});

test('SQL fresher evidence agrees with fallback for abbreviated, written and structured requirements',async()=>{
  const {db,close}=await discoveryDatabase();
  try{
    const fixtures=[
      {title:'Frontend Intern',experience:'Requires 3+ yrs'},
      {title:'Graduate Frontend Engineer',experience:'Requires three years of experience'},
      {title:'Frontend Engineer',experience:'Freshers welcome'},
      {title:'Frontend Engineer',experience:'See requirements',enrichment:{description:'Build React interfaces.',arrangement:'Onsite',yearsMin:1}},
      {title:'Junior Frontend Engineer',experience:'See requirements',enrichment:{description:'Build React interfaces.',arrangement:'Onsite',seniority:'Junior'}},
    ];
    await ingest({source:'research:freshers',runId:'explore-freshers-evidence',jobs:fixtures.map((fixture,i)=>({...base,...fixture,url:'https://example.com/evidence/'+i}))},db);
    const payloads=(await db.query('SELECT payload FROM jobs')).rows.map(r=>r.payload),params=new URLSearchParams('freshers=1');
    for(const result of [await listJobs(db,params),filterSeedJobs(payloads,params)])assert.deepEqual(result.jobs.map(j=>j.url).sort(),['https://example.com/evidence/2','https://example.com/evidence/3']);
  }finally{await close()}
});

test('explicit fresher exclusions override positive career-stage labels in SQL and fallback',async()=>{
  const {db,close}=await discoveryDatabase();
  try{
    const jobs=['No freshers','Freshers are not eligible','Not open to freshers'].map((experience,i)=>({...base,title:'Entry-level Frontend Engineer',experience,url:'https://example.com/excluded/'+i}));
    for(const job of jobs)assert.equal(isFresher(job),false,job.experience);
    await ingest({source:'research:excluded',runId:'explore-excluded-freshers',jobs},db);
    const payloads=(await db.query('SELECT payload FROM jobs')).rows.map(r=>r.payload),params=new URLSearchParams('freshers=1');
    assert.equal((await listJobs(db,params)).total,0);assert.equal(filterSeedJobs(payloads,params).total,0);
  }finally{await close()}
});
