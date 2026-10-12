import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const manifest=async path=>JSON.parse(await readFile(new URL('../'+path+'/package.json',import.meta.url),'utf8'));
test('workspace package exports resolve shared logic and database assets',async()=>{
 const {parseApplication}=await import('@frontlane/core/tracker');
 assert.equal(typeof parseApplication,'function');
 const sql=await readFile(new URL(import.meta.resolve('@frontlane/database/schema')),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS applications/);
 const data=JSON.parse(await readFile(new URL(import.meta.resolve('@frontlane/database/seed')),'utf8'));
 assert.equal(data.length,20);
});
test('the web and worker declare shared packages without dependency cycles',async()=>{
 const web=await manifest('apps/web'),worker=await manifest('apps/worker'),core=await manifest('packages/core'),db=await manifest('packages/database');
 assert.equal(web.dependencies['@frontlane/core'],'workspace:*');
 assert.equal(web.dependencies['@frontlane/database'],'workspace:*');
 assert.equal(worker.dependencies['@frontlane/core'],'workspace:*');
 assert.equal(core.dependencies['@frontlane/database'],'workspace:*');
 assert.equal(db.dependencies?.['@frontlane/core'],undefined);
});
