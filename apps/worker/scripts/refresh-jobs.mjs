import {refreshSources,refreshSummary} from '@frontlanejobs/core/sources';

const base=process.env.APP_URL,token=process.env.INGEST_TOKEN;
if(!base||!token||token.length<32)throw Error('Set APP_URL and INGEST_TOKEN');
const sources=await refreshSources(async batch=>{
  const response=await fetch(new URL('/api/ingest/jobs',base),{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify(batch),signal:AbortSignal.timeout(30000),
  });
  if(!response.ok)throw Error('Publish HTTP '+response.status);
  return response.json();
});
const failed=sources.filter(source=>source.status==='failed').map(source=>source.source);
for(let offset=0;offset<failed.length;offset+=20){
  try{
    const response=await fetch(new URL('/api/ingest/status',base),{
      method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify(failed.slice(offset,offset+20)),signal:AbortSignal.timeout(15000),
    });
    if(!response.ok)throw Error('HTTP '+response.status);
  }catch(error){
    console.error('Source failure status could not be persisted: '+error.message);
    process.exitCode=1;
  }
}
const summary=refreshSummary(sources);
console.log(JSON.stringify({sources,summary}));
if(summary.shortfall)console.error(`Daily selection: published ${summary.published}/${summary.target} jobs; shortfall ${summary.shortfall}.`);
if(sources.every(source=>source.status==='failed'))process.exitCode=1;
