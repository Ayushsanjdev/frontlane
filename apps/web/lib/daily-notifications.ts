import {boundedDiscoveryDatabase} from '@frontlanejobs/core/discovery-store';
import {database} from '@frontlanejobs/database/client';
import {dailyNotificationWindow,queuePushDigests,drainPushOutbox} from '@frontlanejobs/core/push-notifications';
import {processEmailDigests} from '@/lib/email-digests';
import {pushAvailable,sendPush} from '@/lib/push-notifications';
export async function processDailyNotifications({createCampaign=false,budgetMs=20000}:{createCampaign?:boolean;budgetMs?:number}={}){
  const started=Date.now();let email:unknown,push:unknown;
  const channelBudget=Math.max(1000,Math.floor(budgetMs/2));
  try{email=await processEmailDigests({createCampaign,budgetMs:channelBudget})}catch{email={available:false,error:'Email processing deferred'}}
  try{
    if(!pushAvailable())push={available:false};
    else{
      const remaining=Math.max(1000,budgetMs-(Date.now()-started)),db=boundedDiscoveryDatabase(database(),performance.now()+remaining),day=dailyNotificationWindow(),signal=AbortSignal.timeout(remaining);
      let queued=0;
      const backlog=(await db.query("SELECT publication_day FROM push_campaigns WHERE complete=false AND publication_day>=(now()-interval '48 hours')::date::text ORDER BY publication_day LIMIT 1")).rows[0];
      if(backlog)queued+=(await queuePushDigests(db,{publicationDay:backlog.publication_day})).queued;
      if(createCampaign&&day&&!signal.aborted)queued+=(await queuePushDigests(db,{publicationDay:day})).queued;
      push={available:true,queued,...await drainPushOutbox(db,{send:sendPush,signal,limit:20})};
    }
  }catch{push={available:false,error:'Push processing deferred'}}
  return {email,push};
}
