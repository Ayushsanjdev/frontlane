import {authorized,ingest} from '@frontlane/core/ingestion';
import {refreshSources} from '@frontlane/core/sources';
import {withRefreshLock} from '@frontlane/core/refresh';
import {database} from '@frontlane/database/client';
import type {PoolClient} from 'pg';
export const runtime='nodejs';
export const maxDuration=300;

export async function GET(request:Request){
  if(!authorized(request,process.env.CRON_SECRET))return Response.json({error:'Unauthorized'},{status:401});
  try{
    const db=database();
    const result=await withRefreshLock(db,async (client:PoolClient)=>{
      const sources=await refreshSources((batch:unknown)=>ingest(batch,db,{client}));
      for(const source of sources.filter(item=>item.status==='failed')){
        await client.query("INSERT INTO source_checks(source,checked_at,status,matched) VALUES($1,now(),'failed',0) ON CONFLICT(source) DO UPDATE SET checked_at=now(),status='failed'",[source.source]);
      }
      return sources;
    });
    return Response.json(result,{status:result.skipped?202:200,headers:{'Cache-Control':'no-store'}});
  }catch{
    return Response.json({error:'Job refresh is unavailable. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
