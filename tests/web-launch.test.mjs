import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

for(const withEnv of [true,false]){
  test('web launcher loads the root environment '+(withEnv?'when present':'when absent'),async()=>{
    const root=await mkdtemp(join(tmpdir(),'frontlane-launch-'));
    try{
      const cwd=join(root,'apps/web');
      await mkdir(join(cwd,'scripts'),{recursive:true});
      if(withEnv)await writeFile(join(root,'.env.local'),'FRONTLANE_LAUNCH_FIXTURE=loaded\n');
      await copyFile(new URL('../apps/web/scripts/load-env.mjs',import.meta.url),join(cwd,'scripts/load-env.mjs'));
      const env={...process.env};delete env.FRONTLANE_LAUNCH_FIXTURE;
      const result=spawnSync(process.execPath,['--import','./scripts/load-env.mjs','--input-type=module','-e',
        'console.log(JSON.stringify({value:process.env.FRONTLANE_LAUNCH_FIXTURE||null}))'],{cwd,env,encoding:'utf8',timeout:10000});
      assert.equal(result.status,0,result.stderr||String(result.error));
      assert.deepEqual(JSON.parse(result.stdout),{value:withEnv?'loaded':null});
    }finally{await rm(root,{recursive:true,force:true})}
  });
}
