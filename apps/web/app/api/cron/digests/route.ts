import {authorized} from '@frontlanejobs/core/ingestion';
import {processEmailDigests} from '@/lib/email-digests';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request){if(!authorized(request,process.env.CRON_SECRET))return Response.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});try{return Response.json(await processEmailDigests(),{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Digest processing unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}})}}
