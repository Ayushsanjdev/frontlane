import {authorized} from '@frontlanejobs/core/ingestion';
import {processDailyNotifications} from '@/lib/daily-notifications';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request){if(!authorized(request,process.env.CRON_SECRET))return Response.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});try{const result=await processDailyNotifications();return Response.json({...result.email as object,push:result.push},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Digest processing unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}})}}
