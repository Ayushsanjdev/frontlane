import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const worker=fileURLToPath(new URL('../apps/worker/scripts/publish-jobs.mjs',import.meta.url));
const preload=fileURLToPath(new URL('./helpers/worker-fetch.mjs',import.meta.url));
test('production refresh worker publishes 50 jobs and emits a summary',()=>{
 const result=spawnSync(process.execPath,['--import',fileURLToPath(new URL('./helpers/refresh-fetch.mjs',import.meta.url)),fileURLToPath(new URL('../apps/worker/scripts/refresh-jobs.mjs',import.meta.url))],{
  env:{...process.env,APP_URL:'https://frontlane.example',INGEST_TOKEN:'t'.repeat(32),FAIL_FEEDS:'false'},encoding:'utf8',timeout:10000,
 });
 assert.equal(result.status,0,result.stderr);
 assert.deepEqual(JSON.parse(result.stdout).summary,{target:50,published:50,shortfall:0,failedSources:0});
});

test('production refresh worker exits unsuccessfully when all employers fail',()=>{
 const result=spawnSync(process.execPath,['--import',fileURLToPath(new URL('./helpers/refresh-fetch.mjs',import.meta.url)),fileURLToPath(new URL('../apps/worker/scripts/refresh-jobs.mjs',import.meta.url))],{
  env:{...process.env,APP_URL:'https://frontlane.example',INGEST_TOKEN:'t'.repeat(32),FAIL_FEEDS:'true'},encoding:'utf8',timeout:10000,
 });
 assert.equal(result.status,1);
 assert.equal(JSON.parse(result.stdout).summary.shortfall,50);
 assert.doesNotMatch(result.stderr,/status could not be persisted/);
});
for(const useInvokingDirectory of [false,true]){
 test('worker publishes a relative batch from '+(useInvokingDirectory?'pnpm INIT_CWD':'the current directory'),async()=>{
  const directory=await mkdtemp(join(tmpdir(),'frontlane-worker-'));
  try{
   await writeFile(join(directory,'batch.json'),JSON.stringify({source:'research:fixture',runId:'workspace-fixture',jobs:[]}));
   const env={...process.env,APP_URL:'https://frontlane.example',INGEST_TOKEN:'worker-fixture-token'};
   delete env.INIT_CWD;
   if(useInvokingDirectory)env.INIT_CWD=directory;
   const result=spawnSync(process.execPath,['--import',preload,worker,'batch.json'],{
    cwd:useInvokingDirectory?fileURLToPath(new URL('../apps/worker/',import.meta.url)):directory,
    env,encoding:'utf8',timeout:10000,
   });
   assert.equal(result.status,0,result.stderr||String(result.error));
   assert.deepEqual(JSON.parse(result.stdout),{accepted:0,runId:'workspace-fixture'});
  }finally{await rm(directory,{recursive:true,force:true})}
 });
}
