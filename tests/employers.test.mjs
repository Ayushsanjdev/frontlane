import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discoveryDatabase} from './helpers/discovery-db.mjs';
import {SOURCES} from '@frontlanejobs/core/sources';
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
