import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {register} from 'node:module';
register('./helpers/route-loader.mjs',import.meta.url);
const alerts=await import('../apps/web/app/api/saved-searches/route.ts');
test('saved searches begin at the current publication boundary and belong to their member',async()=>{
  const pg=new PGlite();for(const file of (await readdir(new URL('../packages/database/schema/',import.meta.url))).filter(v=>v.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../packages/database/schema/'+file,import.meta.url),'utf8'));
  globalThis.__frontlaneRouteTest={user:{userId:'alice'},db:{query:(sql,args)=>pg.query(sql,args),connect:async()=>({query:(sql,args)=>pg.query(sql,args),release(){}})}};process.env.APP_URL='http://localhost:3000';
  try{
    await pg.query("INSERT INTO job_first_publications(canonical_url,job_id) VALUES('https://example.com/old','old')");
    const saved=await alerts.POST(new Request('http://localhost:3000/api/saved-searches',{method:'POST',headers:{origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({name:'React remote',criteria:'stack=React&mode=Remote',enabled:true})}));
    assert.equal(saved.status,201);const data=await saved.json();assert.equal(data.boundary,1);
    globalThis.__frontlaneRouteTest.user={userId:'bob'};
    const list=await alerts.GET(new Request('http://localhost:3000/api/saved-searches'));assert.deepEqual(await list.json(),[]);
  }finally{await pg.close()}
});
