import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/route-loader.mjs',import.meta.url);
const route=path=>import('../apps/web/app/api/'+path+'/route.ts');
const tracker=await route('tracker'),profile=await route('profile'),jobs=await route('jobs'),cron=await route('cron/jobs');
const user={userId:'alice',displayName:'Alice'};
const job={id:'live-2',title:'Frontend Engineer',company:'Example',location:'India',mode:'Remote',type:'Full-time',salary:'Not disclosed',tags:['TypeScript'],experience:'3+ years',summary:'Product frontend',caveat:'Review hours',url:'https://example.com/jobs/2',source:'greenhouse:example',discovered:'2026-10-10',checked:'2026-10-11T09:00:00.000Z',posted:null,eligibility:'India eligible',degree:'Equivalent experience accepted'};
function request(path,body,origin='http://localhost:3000'){
 return new Request('http://localhost:3000/api/'+path,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
}
beforeEach(()=>{
 process.env.APP_URL='http://localhost:3000';
 globalThis.__frontlaneRouteTest={user,db:{query:async()=>{assert.fail('unexpected database access')}}};
});
test('private routes reject unsigned reads and cross-origin writes before accessing the database',async()=>{
 globalThis.__frontlaneRouteTest.user=null;
 assert.equal((await tracker.GET(new Request('http://localhost:3000/api/tracker'))).status,401);
 assert.equal((await profile.GET(new Request('http://localhost:3000/api/profile'))).status,401);
 globalThis.__frontlaneRouteTest.user=user;
 assert.equal((await tracker.POST(request('tracker',{},'https://other.example'))).status,403);
 assert.equal((await profile.POST(request('profile',{},'https://other.example'))).status,403);
});
test('tracker rejects malformed nested values and invalid calendar dates before persistence',async()=>{
 // A malformed payload must not be repaired into a different value and saved.
 globalThis.__frontlaneRouteTest.db={query:async(_sql,args)=>({rows:[{payload:args[3]}]})};
 for(const patch of [{job:{...job,company:{name:'Example'}}},{job:{...job,tags:'TypeScript'}},{followUp:'2026-02-30'}]){
  const response=await tracker.POST(request('tracker',{job,jobId:job.id,stage:'Saved',...patch}));
  assert.equal(response.status,400);
 }
});
test('tracker read, write and delete queries are scoped to the authenticated user',async()=>{
 const id='00000000-0000-4000-8000-000000000001';
 globalThis.__frontlaneRouteTest.db={query:async(sql,args)=>{
  if(sql.startsWith('INSERT')){
   assert.equal(args[1],'alice');
   assert.equal(args[3].job.company,'Example');
   return {rows:[{payload:{...args[3],id}}]};
  }
  assert.match(sql,/user_id=\$[12]/);
  assert.equal(args.at(-1),'alice');
  return {rows:[]};
 }};
 assert.equal((await tracker.GET(new Request('http://localhost:3000/api/tracker'))).status,200);
 const saved=await tracker.POST(request('tracker',{job,stage:'Saved'}));
 assert.equal(saved.status,200);
 assert.equal((await saved.json()).jobId,'live-2');
 const deleted=await tracker.DELETE(new Request('http://localhost:3000/api/tracker',{method:'DELETE',headers:{origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({id})}));
 assert.equal(deleted.status,200);
});
test('profile rejects non-string fields rather than coercing them into stored values',async()=>{
 globalThis.__frontlaneRouteTest.db={query:async()=>({rows:[]})};
 assert.equal((await profile.POST(request('profile',{name:{unexpected:'object'}}))).status,400);
});
test('job ID endpoint returns a live job outside the first list page and 404 for missing jobs',async()=>{
 globalThis.__frontlaneRouteTest.db={query:async(sql,args)=>{
  assert.match(sql,/active=true AND id=\$1/);
  return {rows:args[0]==='live-2'?[{payload:job}]:[]};
 }};
 const found=await jobs.GET(new Request('http://localhost:3000/api/jobs?id=live-2'));
 assert.equal(found.status,200);
 assert.equal((await found.json()).job.id,'live-2');
 assert.equal((await jobs.GET(new Request('http://localhost:3000/api/jobs?id=missing'))).status,404);
});
test('cron processes sources on one connection and releases it after commit',async()=>{
 process.env.CRON_SECRET='c'.repeat(32);
 const calls=[];let connects=0;
 const client={query:async(sql)=>{
  calls.push(sql);
  return {rows:sql.includes('pg_try_advisory_xact_lock')?[{locked:true}]:[]};
 },release:()=>calls.push('release')};
 globalThis.__frontlaneRouteTest.db={connect:async()=>{
  connects++;assert.equal(connects,1,'must reuse the lock connection');return client;
 },query:async()=>assert.fail('must use lock connection for status writes')};
 const original=globalThis.fetch;
 globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('greenhouse')?{jobs:[]}:[]});
 try{
  const response=await cron.GET(new Request('http://localhost:3000/api/cron/jobs',{headers:{authorization:'Bearer '+'c'.repeat(32)}}));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.sources.length,9);
  assert.ok(body.sources.every(source=>source.status==='ok'));
  assert.deepEqual(calls.slice(-2),['COMMIT','release']);
 }finally{globalThis.fetch=original}
});

test('curated fallback metadata preserves job IDs and validates for tracker and ingestion',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {parseApplication}=await import('@frontlane/core/tracker');
 const {Batch}=await import('@frontlane/core/ingestion');
 const data=JSON.parse(await readFile(new URL(import.meta.resolve('@frontlane/database/seed')),'utf8'));
 assert.equal(data[0].id,'a70bef7354d47ad6aa6f2ccc0e62dd9fd393e91984173336610cdb04247fb7ef');
 for(const {requisitionId,...job} of data)assert.equal(parseApplication({job,stage:'Saved'}).jobId,job.id);
 const jobs=data.map(({id,source,discovered,...input})=>input);
 assert.equal(Batch.parse({source:'curated:starter',runId:'starter-2026-10-11',jobs}).jobs.length,20);
});
test('job collection distinguishes an empty live feed from an unavailable database',async()=>{
 const {jobCollection}=await import('../apps/web/lib/jobs.ts');
 globalThis.__frontlaneRouteTest.db={query:async(sql)=>({rows:sql.includes('count(*)')?[{total:0}]:sql.includes('max(completed_at)')?[{last:null}]:[]})};
 const live=await jobCollection(new URLSearchParams({limit:'3'}));
 assert.equal(live.jobs.length,0);
 assert.equal(live.warning,undefined);
 globalThis.__frontlaneRouteTest.db={query:async()=>{throw Error('offline')}};
 const fallback=await jobCollection(new URLSearchParams({limit:'3'}));
 assert.equal(fallback.jobs.length,3);
 assert.ok(fallback.warning);
});
