import assert from 'node:assert/strict';
import {register} from 'node:module';

register('./route-loader.mjs',import.meta.url);
globalThis.fetch=async(url,options)=>{
 assert.equal(String(url),'https://frontlanejobs.example/api/ingest/jobs');
 assert.equal(options.method,'POST');
 assert.equal(options.headers.Authorization,'Bearer worker-fixture-token');
 assert.deepEqual(JSON.parse(options.body),{
  source:'research:fixture',runId:'workspace-fixture',jobs:[],
  completeSnapshot:false,closedUrls:[],
 });
 return Response.json({accepted:0,runId:'workspace-fixture'});
};
