import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseApplication} from '@frontlanejobs/core/tracker';
import {ProfileInput} from '@frontlanejobs/core/profile';
import {filterSeedJobs} from '@frontlanejobs/core/jobs';
const jobs=JSON.parse(await readFile(new URL(import.meta.resolve('@frontlanejobs/database/seed')),'utf8'));
const {requisitionId,...job}=jobs[0];
test('tracker accepts structured interviews, contacts, documents and archive without removing the job',()=>{
  const item=parseApplication({job,stage:'Saved',workspace:{archived:true,priority:'high',nextAction:'Prepare portfolio',contacts:[{id:'one',name:'Recruiter',email:'hr@example.com'}],interviews:[],documents:[],checklist:[],offers:[]}});
  assert.equal(item.workspace.archived,true);
  assert.equal(item.workspace.contacts[0].email,'hr@example.com');
});
test('unknown arrangement is not a confirmed onsite match',()=>{
  const item={...job,mode:'Onsite',enrichment:{description:'',arrangement:'Unknown'}};
  assert.equal(filterSeedJobs([item],new URLSearchParams('mode=Onsite')).total,0);
});
test('matching preferences distinguish salary units and technology choices',()=>{
  const parsed=ProfileInput.parse({matchingPreferences:{skills:['React'],roles:['Frontend Engineer'],cities:['Pune'],arrangements:['Remote'],types:['Full-time'],years:3}});
  assert.equal(parsed.matchingPreferences.years,3);
});
test('multi-stack searches match either selected technology and preserve pagination',()=>{
  const data=[{...job,id:'a',tags:['Vue']},{...job,id:'b',tags:['Angular']},{...job,id:'c',tags:['React']}];
  const params=new URLSearchParams('stack=Vue&stack=Angular&limit=1&page=2');
  const result=filterSeedJobs(data,params);
  assert.equal(result.total,2);
  assert.equal(result.jobs.length,1);
});
