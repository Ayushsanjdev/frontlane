import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {register} from 'node:module';
import {discoveryDatabase} from './helpers/discovery-db.mjs';
register('./helpers/route-loader.mjs',import.meta.url);
const jobs=await import('../apps/web/app/api/jobs/route.ts');
const input=()=>({submissionId:randomUUID(),title:'React Developer',company:'Public Example',location:'India',mode:'Remote',type:'Contract',url:'https://example.com/frontend',summary:'Build useful accessible React interfaces alongside our engineering and design teams.'});
const request=(body,origin='http://localhost:3000')=>new Request('http://localhost:3000/api/jobs',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});

test('publishing requires sign-in and a same-origin request before database access',async()=>{
  process.env.APP_URL='http://localhost:3000';
  globalThis.__frontlaneRouteTest={user:null,db:{connect:()=>assert.fail('no database access')}};
  assert.equal((await jobs.POST(request(input()))).status,401);
  globalThis.__frontlaneRouteTest.user={userId:'google:member'};
  assert.equal((await jobs.POST(request(input(),'https://other.example'))).status,403);
});

test('public POST returns a readable job and duplicate/invalid submissions return useful errors',async()=>{
  const f=await discoveryDatabase();
  process.env.APP_URL='http://localhost:3000';
  globalThis.__frontlaneRouteTest={user:{userId:'google:member'},db:f.db};
  try{
    const body=input(),response=await jobs.POST(request(body));
    assert.equal(response.status,201);
    const result=await response.json();assert.equal(result.job.source,'community');
    assert.equal((await jobs.GET(new Request('http://localhost:3000/api/jobs?id='+result.job.id))).status,200);
    assert.equal((await jobs.POST(request(body))).status,200);
    assert.equal((await jobs.POST(request({...body,submissionId:randomUUID()}))).status,409);
    assert.equal((await jobs.POST(request({...body,source:'spoof'}))).status,400);
    const tooLarge=await jobs.POST(request({...body,summary:'x'.repeat(31000)}));assert.equal(tooLarge.status,400);
  }finally{await f.close()}
});
