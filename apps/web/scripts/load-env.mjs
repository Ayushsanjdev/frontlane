import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';

// All web commands share the workspace root environment. Production-provided
// variables take precedence over values in the optional local file.
try{
  loadEnvFile(fileURLToPath(new URL('../../../.env.local',import.meta.url)));
}catch(error){
  if(error.code!=='ENOENT')throw error;
}

// The Node adapter needs a canonical origin for form actions behind a proxy.
if (!process.env.ORIGIN && process.env.APP_URL) process.env.ORIGIN = process.env.APP_URL;
