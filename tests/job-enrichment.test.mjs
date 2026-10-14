import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchEmployerFeed} from '@frontlanejobs/core/sources';
import {parseApplication} from '@frontlanejobs/core/tracker';

async function job(description,title='Frontend Engineer'){
  const feed=await fetchEmployerFeed(['lever','example','Example'],'2026-10-14T08:00:00Z',{fetchImpl:async()=>Response.json([{id:'1',text:title,categories:{location:'India'},descriptionPlain:description,hostedUrl:'https://example.com/role'}])});
  assert.equal(feed.status,undefined,feed.error);
  return feed.jobs[0];
}
test('React Native alone does not imply React web',async()=>{
  const role=await job('Build React Native apps with TypeScript.');
  assert.deepEqual(role.tags,['React Native','TypeScript']);
});
test('explicit skill and benefit headings retain source-supported detail',async()=>{
  const role=await job('Required skills: React, TypeScript. Preferred skills: Vue. Benefits: Health insurance; Paid leave. Responsibilities: Build web interfaces.');
  assert.deepEqual(role.enrichment.requiredSkills,['React','TypeScript']);
  assert.deepEqual(role.enrichment.preferredSkills,['Vue']);
  assert.deepEqual(role.enrichment.benefits,['Health insurance','Paid leave.']);
});
test('full description and explicit years survive normalization and saving',async()=>{
  const role=await job('Required: 3-5 years of experience. React and TypeScript. '+('Product details. '.repeat(130)));
  assert.equal(role.enrichment.yearsMin,3);
  assert.equal(role.enrichment.yearsMax,5);
  assert.ok(role.enrichment.description.length>1800);
  assert.equal(role.enrichment.arrangement,'Unknown');
  const {requisitionId,...payload}=role;
  const saved=parseApplication({job:{...payload,id:'one',source:'lever:example',discovered:'2026-10-14'},stage:'Saved'});
  assert.equal(saved.job.enrichment.yearsMin,3);
});
test('explicit salary units are preserved without inferring undisclosed pay',async()=>{
  const paid=await job('Salary: INR 1500000 - 2400000 per year. Build Vue interfaces.');
  assert.deepEqual(paid.enrichment.compensation,{min:1500000,max:2400000,currency:'INR',period:'year',sourceText:'INR 1500000 - 2400000 per year'});
  const unknown=await job('Competitive salary. Build Angular interfaces.');
  assert.equal(unknown.enrichment.compensation,undefined);
});
