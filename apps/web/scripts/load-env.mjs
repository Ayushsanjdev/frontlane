import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';

// Next forwards CLI flags to NODE_OPTIONS in its child process. Load the
// workspace's root env file without passing an unsupported env-file flag.
try{
  loadEnvFile(fileURLToPath(new URL('../../../.env.local',import.meta.url)));
}catch(error){
  if(error.code!=='ENOENT')throw error;
}
