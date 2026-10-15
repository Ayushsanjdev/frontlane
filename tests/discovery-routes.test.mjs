import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import {discoveryDatabase} from './helpers/discovery-db.mjs';
register('./helpers/route-loader.mjs',import.meta.url);
const discovery=await import('../apps/web/app/api/cron/discovery/route.ts');
const registry=await import('../apps/web/app/api/ingest/sources/route.ts');
const cron=await import('../apps/web/app/api/cron/jobs/route.ts');

test('discovery and source registry reject unauthenticated requests before database access',async()=>{
  process.env.CRON_SECRET='c'.repeat(32);process.env.INGEST_TOKEN='i'.repeat(32);
  globalThis.__frontlaneRouteTest={db:{query:()=>assert.fail('no database access')}};
  assert.equal((await discovery.GET(new Request('https://example.com/api/cron/discovery'))).status,401);
  assert.equal((await registry.GET(new Request('https://example.com/api/ingest/sources'))).status,401);
  assert.equal((await registry.POST(new Request('https://example.com/api/ingest/sources',{method:'POST'}))).status,401);
});

test('registry-backed cron includes discovered employers and missing keys skip searches',async()=>{
  const f=await discoveryDatabase();
  const previous=globalThis.fetch,key=process.env.BRAVE_SEARCH_API_KEY;
  process.env.CRON_SECRET='c'.repeat(32);process.env.INGEST_TOKEN='i'.repeat(32);delete process.env.BRAVE_SEARCH_API_KEY;
  globalThis.__frontlaneRouteTest={db:f.db};
  try{
    const auth={authorization:'Bearer '+'c'.repeat(32)};
    const skipped=await discovery.GET(new Request('https://example.com/api/cron/discovery',{headers:auth}));
    assert.equal(skipped.status,200);assert.equal((await skipped.json()).searchesReserved,0);
    await f.db.query("INSERT INTO employer_sources(source,provider,slug,company,origin,verified_at) VALUES('greenhouse:routenewco','greenhouse','routenewco','Route New Co','discovered',now())");
    await f.db.query("INSERT INTO employer_sources(source,provider,slug,company,origin,verified_at) SELECT 'greenhouse:xco'||n,'greenhouse','xco'||n,'X Co '||n,'discovered',now() FROM generate_series(1,21) n");
    globalThis.fetch=async input=>Response.json(String(input).includes('amazon.jobs')?{hits:0,jobs:[]}:String(input).includes('ashbyhq')?{jobs:[]}:String(input).includes('smartrecruiters')?{content:[],totalFound:0}:String(input).includes('greenhouse')?{jobs:[]}:[]);
    const refreshed=await cron.GET(new Request('https://example.com/api/cron/jobs',{headers:auth}));
    assert.equal(refreshed.status,200);
    const refreshedBody=await refreshed.json();
    assert.ok(refreshedBody.sources.some(r=>r.source==='greenhouse:routenewco'));
    assert.equal(refreshedBody.deferredEmployers,2);
    const headers={authorization:'Bearer '+'i'.repeat(32),'Content-Type':'application/json'};
    const invalid=await registry.POST(new Request('https://example.com/api/ingest/sources',{method:'POST',headers,body:JSON.stringify({checkedSources:['research:private']})}));
    assert.equal(invalid.status,400);
    const selection=await registry.GET(new Request('https://example.com/api/ingest/sources',{headers}));
    assert.ok((await selection.json()).sources.some(r=>r[1]==='routenewco'));
  }finally{globalThis.fetch=previous;if(key===undefined)delete process.env.BRAVE_SEARCH_API_KEY;else process.env.BRAVE_SEARCH_API_KEY=key;await f.close()}
});
