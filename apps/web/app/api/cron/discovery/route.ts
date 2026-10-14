import {authorized} from '@frontlanejobs/core/ingestion';
import {runDiscovery} from '@frontlanejobs/core/discovery';
import {database} from '@frontlanejobs/database/client';
export const runtime='nodejs';
export const maxDuration=30;

export async function GET(request:Request){
  if(!authorized(request,process.env.CRON_SECRET))return Response.json({error:'Unauthorized'},{status:401});
  try{
    const summary=await runDiscovery(database(),{apiKey:process.env.BRAVE_SEARCH_API_KEY});
    return Response.json(summary,{status:summary.status==='busy'?202:200,headers:{'Cache-Control':'no-store'}});
  }catch{
    return Response.json({error:'Company discovery is unavailable. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
