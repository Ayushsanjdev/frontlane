import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseApplication,parseRemoval} from '@frontlane/core/tracker';
import {filterSeedJobs,listJobs,getJob} from '@frontlane/core/jobs';
import {loadProfile} from '@frontlane/core/profile';
import {withRefreshLock} from '@frontlane/core/refresh';

const job={id:'live-2',title:'Frontend Engineer',company:'Example',location:'India',mode:'Remote',type:'Full-time',salary:'Not disclosed',tags:['TypeScript'],experience:'3+ years',summary:'Product frontend',caveat:'Review hours',url:'https://example.com/jobs/2',source:'greenhouse:example',discovered:'2026-10-10',checked:'2026-10-11T09:00:00.000Z',posted:null,eligibility:'India eligible',degree:'Equivalent experience accepted'};
const application={jobId:job.id,job,stage:'Saved'};

test('tracker accepts a complete job and defaults optional notes',()=>{
 const item=parseApplication(application);
 assert.equal(item.job.company,'Example');
 assert.equal(item.notes,'');
 assert.equal(item.jobId,'live-2');
});
test('tracker rejects malformed fields, unknown fields and conflicting IDs',()=>{
 for(const patch of [{company:{}},{tags:'TypeScript'},{url:'javascript:alert(1)'},{unexpected:true}]){
  assert.throws(()=>parseApplication({...application,job:{...job,...patch}}));
 }
 assert.throws(()=>parseApplication({...application,jobId:'another-job'}));
 assert.throws(()=>parseApplication({...application,notes:{private:'value'}}));
 assert.throws(()=>parseRemoval({id:'invalid'}));
});
test('application stages require evidence and real calendar dates',()=>{
 assert.throws(()=>parseApplication({...application,stage:'Applied'}));
 assert.throws(()=>parseApplication({...application,followUp:'2026-02-30'}));
 assert.throws(()=>parseApplication({...application,stage:'Offer',appliedAt:'2026-10-11',evidence:'   '}));
 assert.equal(parseApplication({...application,stage:'Applied',appliedAt:'2026-10-11',evidence:'Confirmation email received'}).stage,'Applied');
});
test('curated search includes technology tags and sorts newest first',()=>{
 const older={...job,id:'old',discovered:'2026-10-01'};
 const result=filterSeedJobs([older,job],new URLSearchParams({q:'TypeScript',sort:'newest'}));
 assert.deepEqual(result.jobs.map(x=>x.id),['live-2','old']);
 assert.equal(result.total,2);
 assert.equal(filterSeedJobs([job],new URLSearchParams({q:'%',page:'1'})).total,0);
});
test('live search includes tags, binds search terms and selects separate newest order',async()=>{
 const queries=[];
 const db={query:async(sql,args)=>{
  queries.push({sql,args});
  if(sql.includes('count(*)'))return {rows:[{total:1}]};
  if(sql.includes('SELECT payload'))return {rows:[{payload:job}]};
  if(sql.includes('max(completed_at)'))return {rows:[{last:null}]};
  return {rows:[]};
 }};
 const result=await listJobs(db,new URLSearchParams({q:'TypeScript',sort:'newest'}));
 assert.equal(result.jobs[0].id,'live-2');
 assert.match(queries[0].sql,/payload->'tags'/);
 assert.ok(queries[0].args.includes('%TypeScript%'));
 assert.match(queries[1].sql,/ORDER BY discovered_at DESC/);
 assert.doesNotMatch(queries[1].sql,/CASE WHEN/);
 queries.length=0;
 await listJobs(db,new URLSearchParams({q:'TypeScript',sort:'recommended'}));
 assert.match(queries[1].sql,/CASE WHEN/);
});
test('job detail lookup is independent of list pagination and excludes inactive rows',async()=>{
 const db={query:async(sql,args)=>{
  assert.match(sql,/active=true/);
  assert.match(sql,/id=\$1/);
  assert.deepEqual(args,['live-2']);
  return {rows:[{payload:job}]};
 }};
 assert.equal((await getJob(db,'live-2')).id,'live-2');
 assert.equal(await getJob({query:async()=>({rows:[]})},'missing'),null);
});
test('profile retrieval failure cannot become an editable empty profile',async()=>{
 await assert.rejects(loadProfile({query:async()=>{throw Error('offline')}},'alice'),/offline/);
 assert.deepEqual(await loadProfile({query:async(sql,args)=>{
  assert.deepEqual(args,['alice']);
  assert.match(sql,/user_id=\$1/);
  return {rows:[]};
 }},'alice'),{});
});

function connection({lock=true,failBegin=false,failRollback=false}={}){
 const calls=[];
 const client={query:async(sql)=>{
  calls.push(sql);
  if(failBegin&&sql==='BEGIN')throw Error('begin failed');
  if(failRollback&&sql==='ROLLBACK')throw Error('rollback failed');
  if(sql.includes('pg_try_advisory_xact_lock'))return {rows:[{locked:lock}]};
  return {rows:[]};
 },release:discard=>calls.push(discard?'discard':'release')};
 return {calls,client,pool:{connect:async()=>client}};
}
test('refresh uses the locked connection and commits before release',async()=>{
 const c=connection();
 const result=await withRefreshLock(c.pool,async client=>{
  assert.equal(client,c.client);
  await client.query('source write');
  return ['ok'];
 });
 assert.deepEqual(result,{sources:['ok']});
 assert.deepEqual(c.calls.slice(-3),['source write','COMMIT','release']);
});
test('refresh rolls back and releases after failures, including lock setup',async()=>{
 for(const options of [{},{failBegin:true}]){
  const c=connection(options);
  await assert.rejects(withRefreshLock(c.pool,async()=>{throw Error('refresh failed')}));
  assert.ok(c.calls.includes('ROLLBACK'));
  assert.equal(c.calls.at(-1),'release');
 }
 const c=connection({failRollback:true});
 await assert.rejects(withRefreshLock(c.pool,async()=>{throw Error('refresh failed')}),/refresh failed/);
 assert.equal(c.calls.at(-1),'discard');
});
test('refresh skips work when another refresh holds the lock',async()=>{
 const c=connection({lock:false});
 const result=await withRefreshLock(c.pool,async()=>{assert.fail('must not refresh')});
 assert.equal(result.skipped,'Refresh already running');
 assert.deepEqual(c.calls.slice(-2),['ROLLBACK','release']);
});

test('recommended order compares verification instants across timezone offsets',()=>{
 const older={...job,id:'older',checked:'2026-10-11T10:00:00+02:00'};
 const newer={...job,id:'newer',checked:'2026-10-11T09:00:00Z'};
 assert.deepEqual(filterSeedJobs([older,newer],new URLSearchParams()).jobs.map(job=>job.id),['newer','older']);
});
