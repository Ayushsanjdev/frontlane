import {authorized} from '@frontlanejobs/core/ingestion';
import {refreshRemoteJobs} from '@frontlanejobs/core/remote-refresh';
import {database} from '@frontlanejobs/database/client';

export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request){
  const headers={'Cache-Control':'no-store'};
  if(!authorized(request,process.env.CRON_SECRET)&&!authorized(request,process.env.INGEST_TOKEN))return Response.json({error:'Unauthorized'},{status:401,headers});
  try{
    const result=await refreshRemoteJobs(database(),{signal:AbortSignal.timeout(25000)});
    if(result.skipped)return Response.json(result,{status:202,headers});
    const failed=result.sources?.every(source=>source.status==='failed');
    return Response.json(result,{status:failed?503:200,headers});
  }catch{return Response.json({error:'Remote job refresh is unavailable. Please try again.'},{status:503,headers})}
}
