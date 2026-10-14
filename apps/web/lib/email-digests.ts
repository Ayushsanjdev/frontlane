import {database} from '@frontlanejobs/database/client';
import {queueDailyDigests,drainDigestOutbox,publicationDay} from '@frontlanejobs/core/email-digests';
import {resendTransport} from '@frontlanejobs/core/email-transport';
export function emailAvailable(){return !!(process.env.RESEND_API_KEY?.trim()&&process.env.EMAIL_FROM?.trim()&&process.env.RESEND_WEBHOOK_SECRET?.trim()&&process.env.APP_URL?.startsWith('https://'))}
export async function processEmailDigests({createCampaign=false,budgetMs=20000}:{createCampaign?:boolean;budgetMs?:number}={}){
  if(!emailAvailable())return {available:false};
  const db=database(),signal=AbortSignal.timeout(Math.max(1000,budgetMs));
  const options={from:process.env.EMAIL_FROM!,appUrl:process.env.APP_URL!,limit:50};
  const backlog=await db.query('SELECT publication_day FROM digest_campaigns WHERE complete=false AND created_at>now()-interval \'48 hours\' ORDER BY created_at LIMIT 1');
  let queued=0;
  if(backlog.rows.length)queued+=(await queueDailyDigests(db,{...options,publicationDay:backlog.rows[0].publication_day})).queued;
  if(createCampaign&&!signal.aborted)queued+=(await queueDailyDigests(db,{...options,publicationDay:publicationDay()})).queued;
  const stats=await drainDigestOutbox(db,{transport:resendTransport(process.env.RESEND_API_KEY!),signal,limit:20});
  return {available:true,queued,...stats};
}
