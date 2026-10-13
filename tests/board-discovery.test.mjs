import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseBoardUrl,verifyCandidate} from '../packages/core/src/board-discovery.mjs';

test('board parser accepts known hosts and preserves case-sensitive identifiers',()=>{
  assert.equal(parseBoardUrl('https://job-boards.greenhouse.io/newco/jobs/123').source,'greenhouse:newco');
  assert.equal(parseBoardUrl('https://boards.greenhouse.io/embed/job_app?for=NewCo&token=123').slug,'NewCo');
  assert.equal(parseBoardUrl('https://jobs.smartrecruiters.com/Nagarro1/123-title').slug,'Nagarro1');
  for(const url of ['https://jobs.lever.co.attacker.example/acme','https://u:p@jobs.lever.co/acme','http://jobs.lever.co/acme','https://jobs.lever.co/robots.txt','https://jobs.lever.co/a%2fb','https://jobs.ashbyhq.com/acme','https://jobs.lever.co/acme/one/two','https://jobs.lever.co/%2e%2e/acme'])assert.equal(parseBoardUrl(url),null,url);
});

const candidate={provider:'greenhouse',slug:'newco',source:'greenhouse:newco'};
function feeds({name='New Company',jobs,redirect=false}={}){
  return async input=>{
    const url=new URL(input);
    assert.equal(url.hostname,'boards-api.greenhouse.io');
    return new Response(JSON.stringify(url.pathname.endsWith('/jobs')?{jobs:jobs??[{id:1,title:'Frontend Engineer',location:{name:'India'},content:'Build React',absolute_url:'https://job-boards.greenhouse.io/newco/jobs/1'}]}:{name}),{status:redirect?302:200});
  };
}
test('verification trusts live eligible employer feeds, not snippets or invented names',async()=>{
  const verified=await verifyCandidate(candidate,{fetchImpl:feeds()});
  assert.equal(verified.status,'verified');assert.equal(verified.company,'New Company');assert.equal(verified.matched,1);
  assert.equal((await verifyCandidate(candidate,{fetchImpl:feeds({name:{bad:true}})})).status,'pending');
  assert.equal((await verifyCandidate(candidate,{fetchImpl:feeds({jobs:[]})})).status,'no-match');
  assert.equal((await verifyCandidate(candidate,{fetchImpl:feeds({redirect:true})})).status,'failed');
  const signal=AbortSignal.abort();
  assert.equal((await verifyCandidate(candidate,{signal,fetchImpl:feeds()})).status,'failed');
});

test('verification refuses unrelated hosted application boards and ambiguous Lever identity',async()=>{
  const jobs=[{id:1,title:'Frontend Engineer',location:{name:'India'},content:'React',absolute_url:'https://job-boards.greenhouse.io/another/jobs/1'}];
  assert.equal((await verifyCandidate(candidate,{fetchImpl:feeds({jobs})})).status,'pending');
  const lever={provider:'lever',slug:'beta',source:'lever:beta'};
  const fetchImpl=async input=>new URL(input).hostname==='jobs.lever.co'?new Response('<title>Jobs at Beta Company</title>'):new Response(JSON.stringify([{id:'1',text:'React Developer',categories:{location:'India'},descriptionPlain:'React',hostedUrl:'https://jobs.lever.co/beta/12345678-1234-1234-1234-123456789012'}]));
  assert.equal((await verifyCandidate(lever,{fetchImpl})).company,'Beta Company');
  assert.equal((await verifyCandidate(lever,{fetchImpl:async input=>new URL(input).hostname==='jobs.lever.co'?new Response('<title>Frontend Engineer</title>'):fetchImpl(input)})).status,'pending');
});
