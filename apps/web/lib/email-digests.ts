import {boundedDiscoveryDatabase} from '@frontlanejobs/core/discovery-store';
import {dailyNotificationWindow} from '@frontlanejobs/core/notification-jobs';
import {database} from '@frontlanejobs/database/client';
import {queueDailyDigests,drainDigestOutbox,publicationDay} from '@frontlanejobs/core/email-digests';
import {resendTransport,gmailTransport} from '@frontlanejobs/core/email-transport';
export function emailAvailable(){
  try{if(new URL(process.env.NOTIFICATION_APP_URL||process.env.APP_URL||'').protocol!=='https:')return false}catch{return false}
  const provider=process.env.EMAIL_PROVIDER||'resend';
  if(provider==='gmail')return /^[^\s@]+@gmail\.com$/i.test(process.env.GMAIL_USER?.trim()||'')&&/^[a-z]{16}$/i.test(process.env.GMAIL_APP_PASSWORD?.replace(/\s/g,'')||'');
  return provider==='resend'&&!!(process.env.RESEND_API_KEY?.trim()&&process.env.EMAIL_FROM?.trim()&&process.env.RESEND_WEBHOOK_SECRET?.trim());
}
export async function processEmailDigests({createCampaign=false,budgetMs=20000}:{createCampaign?:boolean;budgetMs?:number}={}){
  if(!emailAvailable())return {available:false};
  const db=boundedDiscoveryDatabase(database(),performance.now()+Math.max(1000,budgetMs)),signal=AbortSignal.timeout(Math.max(1000,budgetMs));
  const gmail=process.env.EMAIL_PROVIDER==='gmail';
  const options={from:gmail?`FrontlaneJobs <${process.env.GMAIL_USER!.trim()}>`:process.env.EMAIL_FROM!,appUrl:(process.env.NOTIFICATION_APP_URL||process.env.APP_URL)!,limit:50};
  const backlog=await db.query('SELECT publication_day FROM digest_campaigns WHERE complete=false AND created_at>now()-interval \'48 hours\' ORDER BY created_at LIMIT 1');
  let queued=0;
  if(backlog.rows.length)queued+=(await queueDailyDigests(db,{...options,publicationDay:backlog.rows[0].publication_day})).queued;
  if(createCampaign&&dailyNotificationWindow()&&!signal.aborted)queued+=(await queueDailyDigests(db,{...options,publicationDay:publicationDay()})).queued;
  const stats=await drainDigestOutbox(db,{transport:gmail?gmailTransport(process.env.GMAIL_USER!.trim(),process.env.GMAIL_APP_PASSWORD!):resendTransport(process.env.RESEND_API_KEY!),transportName:gmail?'gmail':'resend',from:options.from,signal,limit:20});
  return {available:true,queued,...stats};
}
