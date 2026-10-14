import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {ingest} from '@frontlanejobs/core/ingestion';
const example={title:'Frontend Engineer',company:'Example',location:'India',mode:'Remote',type:'Full-time',salary:'Not disclosed',tags:['TypeScript'],experience:'Unknown',summary:'Build web interfaces.',caveat:'Check employer',url:'https://example.com/1',checked:'2026-10-14T08:00:00Z',posted:null,eligibility:'India',degree:'Unknown'};
test('rechecking and cross-source publication create only one first-publication event',async()=>{
  const pg=new PGlite();await pg.exec(await readFile(new URL('../packages/database/schema/001-init.sql',import.meta.url),'utf8'));
  const db={connect:async()=>({query:(sql,args)=>pg.query(sql,args),release(){}})};
  try{
    await ingest({source:'lever:example',runId:'initial-publication',jobs:[example]},db);
    await ingest({source:'lever:example',runId:'recheck-publication',jobs:[example]},db);
    await ingest({source:'greenhouse:example',runId:'other-publication',jobs:[example]},db);
    const count=await pg.query('SELECT count(*)::int AS n FROM job_first_publications');
    assert.equal(count.rows[0].n,1);
  }finally{await pg.close()}
});
test('daily selection does not close roles still present in a complete employer feed',async()=>{
  const pg=new PGlite();await pg.exec(await readFile(new URL('../packages/database/schema/001-init.sql',import.meta.url),'utf8'));
  const db={connect:async()=>({query:(sql,args)=>pg.query(sql,args),release(){}})};
  try{
    const hidden={...example,url:'https://example.com/hidden'};
    await ingest({source:'lever:example',runId:'full-feed-one',jobs:[example],availableJobs:[example,hidden],completeSnapshot:true},db);
    let row=(await pg.query('SELECT active,source_available FROM jobs WHERE canonical_url=$1',[hidden.url])).rows[0];
    assert.deepEqual(row,{active:false,source_available:true});
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM job_first_publications')).rows[0].n,1);
    await ingest({source:'lever:example',runId:'full-feed-two',jobs:[example],availableJobs:[example],completeSnapshot:true},db);
    row=(await pg.query('SELECT active,source_available FROM jobs WHERE canonical_url=$1',[hidden.url])).rows[0];
    assert.deepEqual(row,{active:false,source_available:false});
  }finally{await pg.close()}
});
