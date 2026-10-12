import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as adapters from '@frontlanejobs/core/sources';
import {Batch} from '@frontlanejobs/core/ingestion';

const sources=[['greenhouse','alpha','Alpha'],['lever','beta','Beta'],['lever','gamma','Gamma']];
const greenhouse=(id,patch={})=>({id,title:'Frontend Engineer',location:{name:'Bengaluru, India'},content:'Build React and TypeScript interfaces.',absolute_url:`https://careers.alpha.example/jobs/${id}`,metadata:[],...patch});
const lever=(id,patch={})=>({id:String(id),text:'React Developer',categories:{location:'India',commitment:'Full-time'},descriptionPlain:'Build web interfaces with React.',lists:[],hostedUrl:`https://jobs.lever.co/beta/${id}`,workplaceType:'remote',...patch});
function feeds(t,data){
  t.mock.method(globalThis,'fetch',async url=>{
    const slug=new URL(url).pathname.split('/').at(-1)==='jobs'?new URL(url).pathname.split('/').at(-2):new URL(url).pathname.split('/').at(-1);
    const body=data[slug];
    return {ok:body!==undefined,status:body===undefined?404:200,json:async()=>body};
  });
}

test('daily refresh selects 50 unique jobs with employer and work-arrangement variety',async t=>{
  feeds(t,{
    alpha:{jobs:Array.from({length:110},(_,i)=>greenhouse(i))},
    beta:Array.from({length:30},(_,i)=>lever(i)),
    gamma:Array.from({length:30},(_,i)=>lever(i,{hostedUrl:`https://jobs.lever.co/gamma/${i}`,workplaceType:'hybrid',categories:{location:'Pune, India',commitment:i%2?'Part-time':'Contract'}})),
  });
  const batches=[];
  const results=await adapters.refreshSources(async batch=>{batches.push(Batch.parse(batch));return {accepted:batch.jobs.length}},{sources});
  const jobs=batches.flatMap(batch=>batch.jobs);
  assert.equal(jobs.length,50);
  assert.equal(new Set(jobs.map(job=>job.url)).size,50);
  assert.deepEqual(new Set(jobs.map(job=>job.company)),new Set(['Alpha','Beta','Gamma']));
  assert.deepEqual(new Set(jobs.map(job=>job.mode)),new Set(['Onsite','Remote','Hybrid']));
  assert.deepEqual(new Set(jobs.map(job=>job.type)),new Set(['Full-time','Contract','Part-time']));
  assert.ok(results.every(result=>result.status==='ok'));
  assert.ok(batches.every(batch=>batch.completeSnapshot));
  assert.ok(jobs.every(job=>/careers\.alpha\.example|jobs\.lever\.co/.test(job.url)));
});

test('duplicate career URLs are canonicalized before selecting a daily batch',async t=>{
  feeds(t,{alpha:{jobs:[greenhouse(1),greenhouse(2,{absolute_url:'https://careers.alpha.example/jobs/1?utm_source=duplicate'})]},beta:[lever(3,{hostedUrl:'https://careers.alpha.example/jobs/1#apply'})]});
  const batches=[];
  await adapters.refreshSources(async batch=>{batches.push(batch);return {accepted:batch.jobs.length}},{sources:sources.slice(0,2)});
  assert.deepEqual(batches.flatMap(batch=>batch.jobs).map(job=>job.url),['https://careers.alpha.example/jobs/1']);
});

test('invalid or unavailable source never publishes a replacement snapshot',async t=>{
  feeds(t,{alpha:{jobs:[greenhouse(1,{absolute_url:'javascript:alert(1)'})]},beta:{unexpected:'response'}});
  const batches=[];
  const results=await adapters.refreshSources(async batch=>{batches.push(batch);return {accepted:batch.jobs.length}},{sources});
  assert.equal(batches.length,0);
  assert.equal(results.length,3);
  assert.ok(results.every(result=>result.status==='failed'));
});

test('network failures retry and do not prevent successful employers from publishing',async t=>{
  let attempts=0;
  t.mock.method(globalThis,'fetch',async url=>{
    if(String(url).includes('/alpha/')){attempts++;throw Error('connection reset')}
    return {ok:true,json:async()=>[lever(1)]};
  });
  const batches=[];
  const results=await adapters.refreshSources(async batch=>{batches.push(batch);return {accepted:batch.jobs.length}},{sources:sources.slice(0,2)});
  assert.equal(attempts,2);
  assert.deepEqual(batches.map(batch=>batch.source),['lever:beta']);
  assert.deepEqual(results.map(result=>result.status),['failed','ok']);
});

test('legitimate empty feeds close old selections and report a shortfall',async t=>{
  feeds(t,{alpha:{jobs:[]},beta:[lever(1)]});
  const batches=[];
  const results=await adapters.refreshSources(async batch=>{batches.push(batch);return {accepted:batch.jobs.length}},{sources:sources.slice(0,2)});
  assert.equal(batches.find(batch=>batch.source==='greenhouse:alpha').completeSnapshot,true);
  assert.deepEqual(adapters.refreshSummary(results),{target:50,published:1,shortfall:49,failedSources:0});
});

test('summary counts published jobs rather than jobs from a failed publication',async t=>{
  feeds(t,{alpha:{jobs:[greenhouse(1)]},beta:[lever(1)]});
  const results=await adapters.refreshSources(async batch=>{
    if(batch.source==='greenhouse:alpha')throw Error('Publish HTTP 503');
    return {accepted:batch.jobs.length};
  },{sources:sources.slice(0,2)});
  assert.deepEqual(adapters.refreshSummary(results),{target:50,published:1,shortfall:49,failedSources:1});
});

test('eligibility recognizes UI developers and rejects unrelated or geographically restricted jobs',()=>{
  assert.equal(adapters.eligible('UI Developer','Bangalore, India','Build Angular interfaces'),true);
  assert.equal(adapters.eligible('Frontend Engineer','Worldwide','Must be based in the US'),false);
  assert.equal(adapters.eligible('Backend Engineer','India','React dashboard'),false);
  assert.equal(adapters.eligible('Frontend Engineer','Remote US','React'),false);
});

test('refresh replaces the daily selection transactionally and preserves failed and research sources',async t=>{
  const {readFile}=await import('node:fs/promises');
  const {PGlite}=await import('@electric-sql/pglite');
  const {ingest}=await import('@frontlanejobs/core/ingestion');
  const pg=new PGlite();
  await pg.exec(await readFile(new URL(import.meta.resolve('@frontlanejobs/database/schema')),'utf8'));
  const db={connect:async()=>({query:(...args)=>pg.query(...args),release(){}})};
  const fixture={requisitionId:'old',title:'Frontend Engineer',company:'Old',location:'India',mode:'Remote',type:'Full-time',salary:'Not disclosed',tags:['React'],experience:'See employer requirements',summary:'React',caveat:'',url:'https://careers.example/old',checked:new Date().toISOString(),posted:null,eligibility:'India',degree:''};
  try{
    await ingest({source:'greenhouse:alpha',runId:'previous-alpha',jobs:[fixture]},db);
    await ingest({source:'lever:gamma',runId:'previous-gamma',jobs:[fixture]},db);
    await ingest({source:'research:manual',runId:'previous-research',jobs:[fixture]},db);
    feeds(t,{alpha:{jobs:Array.from({length:60},(_,i)=>greenhouse(i))},beta:[]});
    await adapters.refreshSources(batch=>ingest(batch,db),{sources});
    const counts=(await pg.query('SELECT source,count(*)::int AS count FROM jobs WHERE active GROUP BY source ORDER BY source')).rows;
    assert.deepEqual(counts,[{source:'greenhouse:alpha',count:50},{source:'lever:gamma',count:1},{source:'research:manual',count:1}]);
    assert.equal((await pg.query("SELECT active FROM jobs WHERE source='greenhouse:alpha' AND canonical_url='https://careers.example/old'")).rows[0].active,false);
    await adapters.refreshSources(batch=>ingest(batch,db),{sources});
    assert.equal((await pg.query("SELECT count(*)::int AS count FROM jobs WHERE source='greenhouse:alpha' AND active")).rows[0].count,50);
  }finally{await pg.close()}
});

test('SmartRecruiters pages India jobs and publishes verified career-page details',async t=>{
  const offsets=[];
  const listing=id=>({id,name:'Senior Engineer - React',location:{country:'in',fullLocation:'Pune, India',hybrid:true},typeOfEmployment:{label:'Contract'}});
  t.mock.method(globalThis,'fetch',async url=>{
    const u=new URL(url);
    assert.equal(u.hostname,'api.smartrecruiters.com');
    if(u.pathname.endsWith('/postings')){
      assert.equal(u.searchParams.get('country'),'in');
      offsets.push(Number(u.searchParams.get('offset')));
      return {ok:true,json:async()=>({totalFound:2,content:[listing(offsets.length)]})};
    }
    const id=u.pathname.split('/').at(-1);
    return {ok:true,json:async()=>({...listing(id),postingUrl:`https://jobs.smartrecruiters.com/Example/${id}`,releasedDate:'2026-01-01T00:00:00.000Z',jobAd:{sections:{jobDescription:{text:'Build React interfaces'}}}})};
  });
  const batches=[];
  await adapters.refreshSources(async batch=>{batches.push(Batch.parse(batch));return {accepted:batch.jobs.length}},{sources:[['smartrecruiters','Example','Example']]});
  assert.deepEqual(offsets,[0,1]);
  assert.equal(batches.length,1);
  assert.equal(batches[0].source,'smartrecruiters:example');
  assert.equal(batches[0].jobs.length,2);
  assert.equal(batches[0].jobs[0].url,'https://jobs.smartrecruiters.com/Example/1');
  assert.equal(batches[0].jobs[0].mode,'Hybrid');
  assert.equal(batches[0].jobs[0].type,'Contract');
  assert.match(batches[0].jobs[0].summary,/Build React/);
});

test('SmartRecruiters incomplete pagination preserves previous selection',async t=>{
  t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>({totalFound:2,content:[]})}));
  const results=await adapters.refreshSources(async()=>assert.fail('must not replace failed feed'),{sources:[['smartrecruiters','Example','Example']]});
  assert.equal(results[0].status,'failed');
});

test('mixed frontend seniority includes staff, principal, UI and Angular engineering roles',()=>{
 for(const title of ['Staff Frontend Engineer','Principal Engineer, React','Senior Software Engineer - UI','Senior Engineer, Angular'])assert.equal(adapters.eligible(title,'India','Build interfaces'),true,title);
 assert.equal(adapters.eligible('UI Designer','India','Figma'),false);
 assert.equal(adapters.eligible('Engineering Manager, Frontend','India','React'),false);
});
