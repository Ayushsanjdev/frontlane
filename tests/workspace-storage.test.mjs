import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {register} from 'node:module';
register('./helpers/route-loader.mjs',import.meta.url);
const tracker=await import('../apps/web/app/api/tracker/route.ts');
const recommendations=await import('../apps/web/app/api/recommendations/route.ts');
const seed=JSON.parse(await readFile(new URL(import.meta.resolve('@frontlanejobs/database/seed')),'utf8'));
const {requisitionId,...job}=seed[0];
test('tracker patches are owner scoped, conflict checked, and recorded in history',async()=>{
  const pg=new PGlite();for(const name of (await readdir(new URL('../packages/database/schema/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../packages/database/schema/'+name,import.meta.url),'utf8'));
  const db={query:(sql,args)=>pg.query(sql,args),connect:async()=>({query:(sql,args)=>pg.query(sql,args),release(){}})};
  globalThis.__frontlaneRouteTest={user:{userId:'alice'},db};process.env.APP_URL='http://localhost:3000';
  const req=(method,body)=>new Request('http://localhost:3000/api/tracker',{method,headers:{origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify(body)});
  try{
    const saved=await (await tracker.POST(req('POST',{action:'save',job}))).json();
    assert.equal(typeof tracker.PATCH,'function','quick updates need a PATCH route');
    const changed=await tracker.PATCH(req('PATCH',{id:saved.id,revision:saved.revision||0,changes:{stage:'Preparing',workspace:{nextAction:'Choose resume'}}}));
    assert.equal(changed.status,200);
    const item=await changed.json();assert.equal(item.stage,'Preparing');assert.equal(item.workspace.nextAction,'Choose resume');assert.equal(item.job.availability,'unknown');
    assert.equal((await tracker.PATCH(req('PATCH',{id:item.id,revision:0,changes:{stage:'Saved'}}))).status,409);
    globalThis.__frontlaneRouteTest.user={userId:'bob'};
    assert.equal((await tracker.PATCH(req('PATCH',{id:item.id,revision:item.revision,changes:{stage:'Saved'}}))).status,404);
    assert.equal((await pg.query("SELECT count(*)::int AS n FROM application_activity WHERE application_id=$1 AND kind IN ('saved','stage')",[item.id])).rows[0].n,2);
  }finally{await pg.close()}
});
test('recommendations apply visible search restrictions and tracker reports current closure separately',async()=>{
  const pg=new PGlite();for(const name of (await readdir(new URL('../packages/database/schema/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../packages/database/schema/'+name,import.meta.url),'utf8'));
  const db={query:(sql,args)=>pg.query(sql,args),connect:async()=>({query:(sql,args)=>pg.query(sql,args),release(){}})};globalThis.__frontlaneRouteTest={user:{userId:'alice'},db};process.env.APP_URL='http://localhost:3000';
  try{
    await pg.query('INSERT INTO profiles(user_id,payload) VALUES($1,$2)',['alice',{matchingPreferences:{skills:['React'],roles:[],cities:[],arrangements:[],types:[]}}]);
    await pg.query('INSERT INTO jobs(id,source,canonical_url,payload,source_available) VALUES($1,$2,$3,$4,true)',[job.id,job.source,job.url,job]);
    const filtered=await recommendations.GET(new Request('http://localhost:3000/api/recommendations?q=no-such-role'));assert.equal((await filtered.json()).total,0);
    const request=new Request('http://localhost:3000/api/tracker',{method:'POST',headers:{origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({action:'save',job})});await tracker.POST(request);
    await pg.query('UPDATE jobs SET active=false,source_available=false WHERE id=$1',[job.id]);
    const response=await tracker.GET(new Request('http://localhost:3000/api/tracker?paginated=1'));const item=(await response.json()).items[0];
    assert.equal(item.job.availability,'closed');assert.equal(item.job.title,job.title);
  }finally{await pg.close()}
});
test('a combined stage update, completed follow-up and archive records every action',async()=>{
  const pg=new PGlite();for(const name of (await readdir(new URL('../packages/database/schema/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../packages/database/schema/'+name,import.meta.url),'utf8'));
  const db={query:(sql,args)=>pg.query(sql,args),connect:async()=>({query:(sql,args)=>pg.query(sql,args),release(){}})};
  globalThis.__frontlaneRouteTest={user:{userId:'alice'},db};process.env.APP_URL='http://localhost:3000';
  const req=(method,body)=>new Request('http://localhost:3000/api/tracker',{method,headers:{origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify(body)});
  try{
    const saved=await (await tracker.POST(req('POST',{job,stage:'Saved',followUp:'2026-10-10'}))).json();
    const response=await tracker.PATCH(req('PATCH',{id:saved.id,revision:saved.revision||0,changes:{stage:'Applied',appliedAt:'2026-10-14',evidence:'Submitted',followUp:'',completeFollowUp:true,workspace:{archived:true}}}));assert.equal(response.status,200);
    const kinds=(await pg.query('SELECT kind FROM application_activity WHERE application_id=$1',[saved.id])).rows.map(row=>row.kind);
    assert.ok(kinds.includes('stage'));assert.ok(kinds.includes('follow-up'));assert.ok(kinds.includes('follow-up-completed'));assert.ok(kinds.includes('archived'));
  }finally{await pg.close()}
});
