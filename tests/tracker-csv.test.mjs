import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/route-loader.mjs',import.meta.url);
const {trackerCsv}=await import('../apps/web/src/lib/tracker-csv.ts');

test('tracker export preserves quoted notes and neutralizes spreadsheet formulas',()=>{
  const csv=trackerCsv([{job:{company:'=SUM(1,2)',title:'Engineer',url:'https://example.com'},stage:'Saved',appliedAt:'',followUp:'',notes:'Said "hello"\nNext step',answers:' +2+2',evidence:'',updatedAt:'2026-10-12T00:00:00.000Z'}]);
  assert.equal(csv,'"Company","Role","URL","Stage","Application date","Follow-up","Notes","Answers","Evidence","Updated"\r\n"\'=SUM(1,2)","Engineer","https://example.com","Saved","","","Said ""hello""\nNext step","\' +2+2","","2026-10-12T00:00:00.000Z"');
});
