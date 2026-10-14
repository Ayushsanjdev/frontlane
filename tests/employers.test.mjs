import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discoveryDatabase} from './helpers/discovery-db.mjs';
import {SOURCES} from '@frontlanejobs/core/sources';
import {refreshSources} from '@frontlanejobs/core/sources';
import {seedEmployers,upsertCandidate,claimCandidates,recordVerification,registeredSources,markEmployerChecks,discoveryPublicSummary} from '../packages/core/src/employers.mjs';

test('registry preserves seeds, deduplicates candidates, and registers only verified eligible employers',async()=>{
  const f=await discoveryDatabase(),now=new Date('2026-10-14T12:00:00Z');
  try{
    await seedEmployers(f.db);await seedEmployers(f.db);
    assert.equal((await registeredSources(f.db,{now})).sources.length,SOURCES.length);
    const candidate={provider:'greenhouse',slug:'newco',source:'greenhouse:newco',boardUrl:'https://job-boards.greenhouse.io/newco',query:'fixture'};
    assert.equal((await upsertCandidate(f.db,candidate,{now})).inserted,true);
    assert.equal((await upsertCandidate(f.db,candidate,{now})).inserted,false);
    const [claim]=await claimCandidates(f.db,{now,limit:4,leaseMs:60000});
    assert.equal((await claimCandidates(f.db,{now,limit:4,leaseMs:60000})).length,0);
    assert.equal((await recordVerification(f.db,{...claim,lease_token:'00000000-0000-4000-8000-000000000001'},{status:'verified',company:'New Co',matched:1},{now})).registered,false);
    assert.equal((await recordVerification(f.db,claim,{status:'verified',company:'New Co',matched:1},{now})).registered,true);
    assert.ok((await registeredSources(f.db,{now})).sources.some(row=>row[2]==='New Co'));
    const summary=await discoveryPublicSummary(f.db);
    assert.equal(summary.registeredEmployers,1);
    assert.equal(summary.lastRun,null);
    assert.doesNotMatch(JSON.stringify(summary),/fixture|boardUrl/);
  }finally{await f.close()}
});

test('selection priority does not synchronize with the discovered polling window',async()=>{
  const f=await discoveryDatabase();
  try{
    await seedEmployers(f.db);
    // 20 per batch and 43 seeds produce a 63-source selection period.
    await f.db.query("INSERT INTO employer_sources(source,provider,slug,company,origin,verified_at) SELECT 'greenhouse:discover'||n,'greenhouse','discover'||n,'Discovered '||n,'discovered',now() FROM generate_series(1,1260) n");
    const seen=new Set();
    const fetchImpl=async input=>{
      const url=new URL(input),slug=url.pathname.split('/').at(-2);
      if(url.hostname==='api.smartrecruiters.com')return Response.json({content:[],totalFound:0});
      if(url.hostname==='api.lever.co')return Response.json([{id:'1',text:'Frontend Engineer',categories:{location:'India'},descriptionPlain:'React',hostedUrl:input+'/job'}]);
      return Response.json({jobs:[{id:1,title:'Frontend Engineer',location:{name:'India'},content:'React',absolute_url:`https://job-boards.greenhouse.io/${slug}/jobs/1`}]});
    };
    for(let day=0;day<126;day++){
      const now=new Date(Date.UTC(2026,9,14+day)),selection=await registeredSources(f.db,{now});
      const outcomes=await refreshSources(async batch=>{if(batch.jobs.length)seen.add(batch.source);return {}},{sources:selection.sources,rotation:selection.rotation,fetchImpl});
      await markEmployerChecks(f.db,outcomes,{now});
    }
    assert.equal([...seen].filter(source=>source.startsWith('greenhouse:discover')).length,1260);
  }finally{await f.close()}
});

test('registry bounds discovered boards, rotates failures, and retries no-match candidates',async()=>{
  const f=await discoveryDatabase(),now=new Date('2026-10-14T12:00:00Z');
  try{
    await seedEmployers(f.db);
    for(let i=0;i<22;i++)await f.db.query("INSERT INTO employer_sources(source,provider,slug,company,origin,verified_at) VALUES($1,'lever',$2,$2,'discovered',$3)",['lever:company'+i,'company'+i,now]);
    const first=await registeredSources(f.db,{now});
    assert.equal(first.sources.length,SOURCES.length+20);assert.equal(first.deferred,2);
    await markEmployerChecks(f.db,[{source:'lever:company0',status:'failed'}],{now});
    assert.ok(!(await registeredSources(f.db,{now})).sources.some(row=>row[1]==='company0'));
    await upsertCandidate(f.db,{source:'lever:emptyco',provider:'lever',slug:'emptyco',boardUrl:'https://jobs.lever.co/emptyco',query:'test'},{now});
    const [claim]=await claimCandidates(f.db,{now,limit:1,leaseMs:1000});
    await recordVerification(f.db,claim,{status:'no-match'},{now});
    assert.equal((await claimCandidates(f.db,{now,limit:1,leaseMs:1000})).length,0);
    assert.equal((await claimCandidates(f.db,{now:new Date(now.getTime()+8*86400000),limit:1,leaseMs:1000})).length,1);
  }finally{await f.close()}
});
