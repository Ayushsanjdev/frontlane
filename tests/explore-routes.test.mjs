import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
import {discoveryDatabase} from './helpers/discovery-db.mjs';
register('./helpers/route-loader.mjs',import.meta.url);
const {saveSearch,evaluateNotifications}=await import('@frontlanejobs/core/job-alerts');
const {ingest}=await import('@frontlanejobs/core/ingestion');
const {fetchEmployerFeed}=await import('@frontlanejobs/core/sources');
const {parseSave}=await import('@frontlanejobs/core/tracker');
const recommendations=await import('../apps/web/app/api/recommendations/route.ts');
const checked=new Date().toISOString();
const job={title:'Frontend Intern',company:'Google',location:'India',mode:'Onsite',type:'Full-time',salary:'Not disclosed',tags:['React'],experience:'No experience required',summary:'Build React interfaces.',caveat:'Check employer',url:'https://example.com/google',checked,posted:null,eligibility:'India',degree:'Review requirements'};

test('Explore recommendations filter before candidate limits and respect hidden companies',async()=>{
  const f=await discoveryDatabase();
  try{
    await f.db.query('CREATE TABLE job_feedback(user_id text,kind text,target text)');
    await f.db.query('INSERT INTO profiles(user_id,payload) VALUES($1,$2)',['alice',{matchingPreferences:{skills:['React']}}]);
    await ingest({source:'research:google',runId:'explore-rank-google',jobs:[job]},f.db);
    await f.db.query("UPDATE jobs SET discovered_at='2020-01-01'");
    await f.db.query("INSERT INTO jobs(id,source,canonical_url,payload) SELECT 'other'||n,'greenhouse:other','https://example.com/other/'||n,$1::jsonb||jsonb_build_object('id','other'||n,'source','greenhouse:other','company','Other','url','https://example.com/other/'||n,'discovered','2026-10-15') FROM generate_series(1,2000) n",[job]);
    globalThis.__frontlaneRouteTest={db:f.db,user:{userId:'alice'}};
    const response=await recommendations.GET(new Request('https://example.com/api/recommendations?companyGroup=faang&freshers=1'));
    assert.equal(response.status,200,JSON.stringify(await response.clone().json()));const result=await response.json();assert.equal(result.total,1);assert.equal(result.jobs[0].company,'Google');
    await f.db.query("INSERT INTO job_feedback VALUES('alice','company','google')");
    assert.equal((await (await recommendations.GET(new Request('https://example.com/api/recommendations?companyGroup=faang&freshers=1'))).json()).total,0);
  }finally{await f.close()}
});

test('saved Explore searches alert only for matching new publications and stay private',async()=>{
  const f=await discoveryDatabase();
  try{
    for(const file of ['006-private-workspace.sql','007-alerts.sql'])await f.pg.exec(await readFile(new URL('../packages/database/schema/'+file,import.meta.url),'utf8'));
    const saved=await saveSearch(f.db,'alice',{name:'My first FAANG role',criteria:'companyGroup=faang&freshers=1',enabled:true});
    assert.equal(saved.criteria,'companyGroup=faang&freshers=1');
    await ingest({source:'greenhouse:example',runId:'explore-notifications-1',jobs:[{...job,title:'Senior Frontend Engineer',experience:'5 years',url:'https://example.com/senior'}],availableJobs:[job,{...job,title:'Senior Frontend Engineer',experience:'5 years',url:'https://example.com/senior'},{...job,company:'Other',url:'https://example.com/not-faang'}],completeSnapshot:true},f.db);
    assert.deepEqual(await evaluateNotifications(f.db,'bob'),{added:0});
    assert.deepEqual(await evaluateNotifications(f.db,'alice'),{added:1});
    assert.deepEqual(await evaluateNotifications(f.db,'alice'),{added:0});
    const rows=(await f.db.query('SELECT user_id,job FROM job_notifications')).rows;
    assert.equal(rows.length,1);assert.equal(rows[0].user_id,'alice');assert.equal(rows[0].job.title,'Frontend Intern');
  }finally{await f.close()}
});

test('employer internships survive feed normalization and private tracker validation',async()=>{
  const feed=await fetchEmployerFeed(['lever','example','Example'],checked,{fetchImpl:async()=>Response.json([{id:'intern-1',text:'Frontend Intern',categories:{location:'India'},descriptionPlain:'No experience required. Build React interfaces.',hostedUrl:'https://example.com/intern'}])});
  assert.equal(feed.jobs.length,1);assert.equal(feed.jobs[0].enrichment.careerStage,'Internship');
  const {requisitionId,...input}=feed.jobs[0];
  const saved=parseSave({action:'save',job:{...input,id:'intern-1',source:'lever:example',discovered:'2026-10-15'}});
  assert.equal(saved.job.enrichment.careerStage,'Internship');
});

test('junior titles alone do not confirm fresher eligibility, and abbreviated higher requirements override internship titles',async()=>{
  const {isFresher}=await import('@frontlanejobs/core/explore');
  const feed=await fetchEmployerFeed(['lever','example','Example'],checked,{fetchImpl:async()=>Response.json([{id:'junior-1',text:'Junior Frontend Engineer',categories:{location:'India'},descriptionPlain:'Build React interfaces. See employer requirements.',hostedUrl:'https://example.com/junior'}])});
  assert.equal(isFresher(feed.jobs[0]),false);
  assert.equal(isFresher({...job,experience:'Requires 3+ yrs of experience'}),false);
  assert.equal(isFresher({...job,experience:'Requires three years of experience'}),false);
});
