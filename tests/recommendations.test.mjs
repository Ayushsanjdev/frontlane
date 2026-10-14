import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rankRecommendations} from '../packages/core/src/recommendations.mjs';
const jobs=JSON.parse(await readFile(new URL(import.meta.resolve('@frontlanejobs/database/seed')),'utf8'));
test('matches explain real skill overlap and exclude hidden jobs',()=>{
  const input=[{...jobs[0],id:'one',company:'One',tags:['React']},{...jobs[0],id:'two',company:'Two',tags:['Vue']}];
  const prefs={skills:['React'],roles:[],cities:[],arrangements:[],types:[]};
  const result=rankRecommendations(input,prefs,[]);
  assert.equal(result[0].id,'one');assert.ok(result[0].matchReasons.includes('Matches React'));
  assert.deepEqual(rankRecommendations(input,prefs,[{kind:'job',target:'one'}]).map(j=>j.id),['two']);
});
test('known incompatible restrictions are excluded while unknown facts remain explicit',()=>{
  const input=[{...jobs[0],id:'unknown',enrichment:{description:'',arrangement:'Unknown'}},{...jobs[0],id:'onsite',enrichment:{description:'',arrangement:'Onsite'}}];
  const result=rankRecommendations(input,{skills:['React'],roles:[],cities:[],arrangements:['Remote'],types:[]},[]);
  assert.deepEqual(result.map(j=>j.id),['unknown']);assert.ok(result[0].matchUnknowns.includes('Work arrangement not confirmed'));
});
