import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const web=new URL('../apps/web/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('package.json',web),'utf8'));
const utils=fileURLToPath(new URL('node_modules/next/dist/server/lib/utils.js',web));
for(const withEnv of [true,false]){
 test('web launcher supports Next child processes '+(withEnv?'with root env loaded':'without a root env file'),async()=>{
  const root=await mkdtemp(join(tmpdir(),'frontlane-launch-'));
  try{
   const cwd=join(root,'apps/web');
   await mkdir(join(cwd,'scripts'),{recursive:true});
   if(withEnv)await writeFile(join(root,'.env.local'),'FRONTLANE_LAUNCH_FIXTURE=loaded\n');
   try{await copyFile(new URL('scripts/load-env.mjs',web),join(cwd,'scripts/load-env.mjs'))}catch(e){if(e.code!=='ENOENT')throw e}
   const probe=join(cwd,'probe.cjs');
   await writeFile(probe,`
    const {getParsedNodeOptions,formatNodeOptions}=require(${JSON.stringify(utils)});
    const {nodeOptions,execArgv}=formatNodeOptions(getParsedNodeOptions());
    const child=require('node:child_process').spawnSync(process.execPath,[...execArgv,'-e',
      'console.log(JSON.stringify({value:process.env.FRONTLANE_LAUNCH_FIXTURE||null}))'],{
      env:{...process.env,NODE_OPTIONS:nodeOptions},encoding:'utf8'
    });
    process.stdout.write(child.stdout);process.stderr.write(child.stderr);process.exit(child.status??1);
   `);
   const args=manifest.scripts.dev.split(' ').slice(1);
   const cli=args.indexOf('node_modules/next/dist/bin/next');
   assert.ok(cli>=0);
   const env={...process.env};delete env.FRONTLANE_LAUNCH_FIXTURE;
   const result=spawnSync(process.execPath,[...args.slice(0,cli),probe],{cwd,env,encoding:'utf8',timeout:10000});
   assert.equal(result.status,0,result.stderr||String(result.error));
   assert.deepEqual(JSON.parse(result.stdout),{value:withEnv?'loaded':null});
  }finally{await rm(root,{recursive:true,force:true})}
 });
}
