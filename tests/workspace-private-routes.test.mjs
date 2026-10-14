import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/route-loader.mjs',import.meta.url);
const routes=await Promise.all(['recommendations','job-feedback','saved-searches','notifications','digest-subscription','tracker/metrics','product-events'].map(name=>import('../apps/web/app/api/'+name+'/route.ts')));
beforeEach(()=>{process.env.APP_URL='http://localhost:3000';globalThis.__frontlaneRouteTest={user:null,db:{query:()=>assert.fail('must reject before database access')}}});
test('new private resources reject unsigned access and cross-origin mutations',async()=>{
  for(const route of routes.slice(0,6))if(route.GET)assert.equal((await route.GET(new Request('http://localhost:3000/api/test'))).status,401);
  globalThis.__frontlaneRouteTest.user={userId:'alice',email:'alice@example.com'};
  for(const route of routes.slice(0,6))if(route.POST)assert.equal((await route.POST(new Request('http://localhost:3000/api/test',{method:'POST',headers:{origin:'https://other.example'},body:'{}'}))).status,403);
});
test('email subscription refuses arbitrary recipient input and telemetry rejects private fields',async()=>{
  globalThis.__frontlaneRouteTest.user={userId:'alice',email:'alice@example.com'};
  const request=(body,cookie='')=>new Request('http://localhost:3000/api/test',{method:'POST',headers:{origin:'http://localhost:3000','Content-Type':'application/json',cookie},body:JSON.stringify(body)});
  assert.equal((await routes[4].POST(request({enabled:true,mode:'all',email:'someone-else@example.com'}))).status,400);
  assert.equal((await routes[6].POST(request({event:'search',notes:'private content'},'frontlane_viewer=00000000-0000-4000-8000-000000000001'))).status,400);
});
