import type {PoolClient} from 'pg';
import {createHash} from 'node:crypto';
import {database} from '@frontlanejobs/database/client';
import {discoveryTransaction} from '@frontlanejobs/core/discovery-store';
import {boundedJson} from '@/lib/auth-api';
import {z} from 'zod';
export async function POST(request:Request){
  if(process.env.DISABLE_PRODUCT_METRICS==='true')return new Response(null,{status:204});
  if(request.headers.get('origin')!==new URL(process.env.APP_URL||request.url).origin)return Response.json({error:'Forbidden'},{status:403});
  const viewer=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('frontlane_viewer='))?.slice('frontlane_viewer='.length);
  if(!viewer||!z.string().uuid().safeParse(viewer).success)return new Response(null,{status:204});
  try{
    const {event}=z.object({event:z.enum(['search','role-view','save','application-confirmed','follow-up-completed'])}).strict().parse(await boundedJson(request,1000));
    await discoveryTransaction(database(),async (client:PoolClient)=>{
      const day=new Date().toISOString().slice(0,10),key=createHash('sha256').update(day+'\0'+viewer).digest('hex');
      const allowed=await client.query('INSERT INTO product_metric_limits(visitor_hash,day,count) VALUES($1,$2,1) ON CONFLICT(visitor_hash,day) DO UPDATE SET count=product_metric_limits.count+1 WHERE product_metric_limits.count<100 RETURNING count',[key,day]);
      if(!allowed.rows.length)return;
      await client.query('INSERT INTO product_metrics(day,event,count) VALUES($1,$2,1) ON CONFLICT(day,event) DO UPDATE SET count=product_metrics.count+1',[day,event]);
      await client.query("DELETE FROM product_metric_limits WHERE day<current_date-interval '2 days'");await client.query("DELETE FROM product_metrics WHERE day<current_date-interval '90 days'");
    });
    return new Response(null,{status:204});
  }catch{return new Response(null,{status:400})}
}
