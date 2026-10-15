const base=process.env.APP_URL,token=process.env.INGEST_TOKEN;
if(!base||!token||token.length<32)throw Error('Set APP_URL and INGEST_TOKEN');
const response=await fetch(new URL('/api/cron/remote-jobs',base),{
  headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(60000),redirect:'error',
});
const result=await response.json();
console.log(JSON.stringify(result));
if(!response.ok)process.exitCode=1;
