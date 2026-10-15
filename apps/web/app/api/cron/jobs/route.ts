import {processDailyNotifications} from '@/lib/daily-notifications';
import {authorized,ingest} from '@frontlanejobs/core/ingestion';
import {refreshSources,refreshSummary} from '@frontlanejobs/core/sources';
import {withRefreshLock} from '@frontlanejobs/core/refresh';
import {seedEmployers,registeredSources,markEmployerChecks} from '@frontlanejobs/core/employers';
import {database} from '@frontlanejobs/database/client';
import type {PoolClient} from 'pg';
export const runtime='nodejs';
export const maxDuration=300;

export async function GET(request:Request){
  if(!authorized(request,process.env.CRON_SECRET))return Response.json({error:'Unauthorized'},{status:401});
  try{
    const started=Date.now();
    const db=database();
    let deferredEmployers=0;
    const result=await withRefreshLock(db,async (client:PoolClient)=>{
      await seedEmployers(client);
      const selection=await registeredSources(client);
      deferredEmployers=selection.deferred;
      const sources=await refreshSources((batch:unknown)=>ingest(batch,db,{client}),{sources:selection.sources,rotation:selection.rotation,fullSnapshots:true,signal:AbortSignal.timeout(270000)});
      await markEmployerChecks(client,sources);
      for(const source of sources.filter(item=>item.status==='failed')){
        await client.query("INSERT INTO source_checks(source,checked_at,status,matched) VALUES($1,now(),'failed',0) ON CONFLICT(source) DO UPDATE SET checked_at=now(),status='failed'",[source.source]);
      }
      return sources;
    });
    if(result.skipped)return Response.json(result,{status:202,headers:{'Cache-Control':'no-store'}});
    const summary=refreshSummary(result.sources);
    let notifications;
    if(summary.failedSources<result.sources.length&&Date.now()-started<285000){try{notifications=await processDailyNotifications({createCampaign:true,budgetMs:Math.min(20000,290000-(Date.now()-started))})}catch{notifications={email:{available:false,error:'Email processing deferred'},push:{available:false,error:'Push processing deferred'}}}}
    return Response.json({...result,summary,deferredEmployers,emailDigests:notifications?.email,pushDigests:notifications?.push},{status:summary.failedSources===result.sources.length?503:200,headers:{'Cache-Control':'no-store'}});
  }catch{
    return Response.json({error:'Job refresh is unavailable. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
