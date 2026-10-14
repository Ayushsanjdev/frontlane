import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register,createRequire} from 'node:module';
import {writeFile,readdir} from 'node:fs/promises';
import {discoveryDatabase} from './helpers/discovery-db.mjs';
register('./helpers/route-loader.mjs',import.meta.url);
const {default:Page}=await import('../apps/web/app/updates/page.tsx');
const {renderToStaticMarkup}=createRequire(new URL('../apps/web/package.json',import.meta.url))('react-dom/server');

test('updates renders populated discovery results without private candidate evidence',async()=>{
  const f=await discoveryDatabase();
  globalThis.__frontlaneRouteTest={db:f.db};
  try{
    await f.db.query("INSERT INTO employer_sources(source,provider,slug,company,origin,verified_at) SELECT 'greenhouse:ui'||n,'greenhouse','ui'||n,'UI Company '||n,'discovered',now() FROM generate_series(1,2) n");
    await f.db.query("INSERT INTO discovery_runs(id,started_at,completed_at,status,summary) VALUES('00000000-0000-4000-8000-000000000001',now(),now(),'partial',$1)",[{registered:2,verified:2,query:'private-search-evidence',apiKey:'never-public-key'}]);
    const markup=renderToStaticMarkup(await Page());
    assert.match(markup,/2 new employers registered/);
    assert.match(markup,/Completed with deferred work/);
    assert.doesNotMatch(markup,/private-search-evidence|never-public-key/);
    if(process.env.FRONTLANE_UI_FIXTURE){
      const files=await readdir(new URL('../apps/web/.next/static/',import.meta.url),{recursive:true});
      const styles=files.filter(name=>name.endsWith('.css')).map(name=>`<link rel="stylesheet" href="http://localhost:3105/_next/static/${name}">`).join('');
      const html=`<!doctype html><html class="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body>${markup}</body></html>`;
      await writeFile(process.env.FRONTLANE_UI_FIXTURE,html);
      await writeFile(process.env.FRONTLANE_UI_FIXTURE.replace(/\.html$/,'.dark.html'),html.replace('class="light"','class="dark"'));
    }
  }finally{await f.close()}
});
