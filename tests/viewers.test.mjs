import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';
import {PGlite} from '@electric-sql/pglite';

register('./helpers/route-loader.mjs',import.meta.url);
const pg=new PGlite();
before(async()=>pg.exec(await readFile(new URL(import.meta.resolve('@frontlane/database/schema')),'utf8')));
after(()=>pg.close());
beforeEach(async()=>{
  process.env.APP_URL='http://localhost:3000';
  globalThis.__frontlaneRouteTest={db:pg};
  await pg.query('DELETE FROM viewers');
});

function heartbeat(cookie,origin='http://localhost:3000'){
  return new Request('http://localhost:3000/api/viewers',{
    method:'POST',headers:{origin,...(cookie?{cookie}:{})}
  });
}

test('anonymous browser heartbeats count once across reloads and tabs',async()=>{
  const {POST:handler}=await import('../apps/web/src/routes/api/viewers/+server.ts');
  const POST=request=>handler({request,url:new URL(request.url),locals:{}});
  const first=await POST(heartbeat());
  assert.equal(first.status,200);
  assert.deepEqual(await first.json(),{total:1,current:1});
  const setCookie=first.headers.get('set-cookie');
  assert.match(setCookie,/HttpOnly/);
  assert.match(setCookie,/SameSite=Lax/);
  assert.equal(first.headers.get('cache-control'),'no-store');
  const cookie=setCookie.split(';')[0];
  for(const response of await Promise.all([POST(heartbeat(cookie)),POST(heartbeat(cookie))])){
    assert.deepEqual(await response.json(),{total:1,current:1});
  }
  const second=await POST(heartbeat());
  assert.deepEqual(await second.json(),{total:2,current:2});
});

test('expired viewers leave the current count while lifetime totals survive',async()=>{
  const {POST:handler}=await import('../apps/web/src/routes/api/viewers/+server.ts');
  const POST=request=>handler({request,url:new URL(request.url),locals:{}});
  await POST(heartbeat());
  await POST(heartbeat());
  await pg.query("UPDATE viewers SET last_seen_at=now()-interval '91 seconds'");
  const returning=await POST(heartbeat('frontlane_viewer=00000000-0000-4000-8000-000000000001'));
  assert.deepEqual(await returning.json(),{total:3,current:1});
  await pg.query("UPDATE viewers SET last_seen_at=now()-interval '89 seconds' WHERE id<>$1",['00000000-0000-4000-8000-000000000001']);
  const next=await POST(heartbeat('frontlane_viewer=00000000-0000-4000-8000-000000000001'));
  assert.deepEqual(await next.json(),{total:3,current:3});
});

test('simultaneous first visits share the browser cookie before counting a second tab',async()=>{
  const {POST:handler}=await import('../apps/web/src/routes/api/viewers/+server.ts');
  const POST=request=>handler({request,url:new URL(request.url),locals:{}});
  const {viewerHeartbeat}=await import('../apps/web/src/lib/viewer-heartbeat.ts');
  const original=globalThis.fetch;
  const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  if(!globalThis.navigator?.locks){
    // Node 22 lacks Web Locks. Model the browser boundary's shared queue there.
    let queue=Promise.resolve();
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{request:(_name,_options,callback)=>{
      const result=queue.then(callback);
      queue=result.catch(()=>{});
      return result;
    }}}});
  }
  let cookie;
  // Keep the route and database real; emulate the browser's cookie storage over HTTP.
  globalThis.fetch=async()=>{
    const request=heartbeat(cookie);
    await new Promise(resolve=>setImmediate(resolve));
    const response=await POST(request);
    cookie=response.headers.get('set-cookie').split(';')[0];
    return response;
  };
  try{
    const responses=await Promise.all([viewerHeartbeat(new AbortController().signal),viewerHeartbeat(new AbortController().signal)]);
    const counts=await Promise.all(responses.map(response=>response.json()));
    assert.deepEqual(counts,[{total:1,current:1},{total:1,current:1}]);
  }finally{
    globalThis.fetch=original;
    if(navigatorDescriptor)Object.defineProperty(globalThis,'navigator',navigatorDescriptor);
    else delete globalThis.navigator;
  }
});

test('cross-origin or missing-origin heartbeats never write visitor records',async()=>{
  const {POST:handler}=await import('../apps/web/src/routes/api/viewers/+server.ts');
  const POST=request=>handler({request,url:new URL(request.url),locals:{}});
  globalThis.__frontlaneRouteTest.db={query:()=>assert.fail('must reject before database access')};
  assert.equal((await POST(heartbeat(undefined,'https://other.example'))).status,403);
  assert.equal((await POST(new Request('http://localhost:3000/api/viewers',{method:'POST'}))).status,403);
});

test('database outages return unavailable counts and malformed cookies are replaced',async()=>{
  const {POST:handler}=await import('../apps/web/src/routes/api/viewers/+server.ts');
  const POST=request=>handler({request,url:new URL(request.url),locals:{}});
  const replaced=await POST(heartbeat('frontlane_viewer=invalid'));
  assert.equal(replaced.status,200);
  assert.match(replaced.headers.get('set-cookie'),/frontlane_viewer=[0-9a-f-]{36};/);
  globalThis.__frontlaneRouteTest.db={query:async()=>{throw Error('offline')}};
  const unavailable=await POST(heartbeat());
  assert.equal(unavailable.status,503);
  assert.equal(unavailable.headers.get('cache-control'),'no-store');
  assert.equal(unavailable.headers.get('set-cookie'),null);
  assert.deepEqual(await unavailable.json(),{error:'Viewer counts unavailable'});
});
