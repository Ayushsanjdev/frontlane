import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {discoveryTransaction} from './discovery-store.mjs';
import {hasMatchingPreferences} from './recommendations.mjs';
import {dailyCutoff,notificationJobs} from './notification-jobs.mjs';
import {WorkspaceError} from './tracker-store.mjs';
export {dailyNotificationWindow} from './notification-jobs.mjs';
const modeInput=z.enum(['matching','all']);
const pushInput=z.object({endpoint:z.string().url().max(2000),expirationTime:z.number().nullable().optional(),keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{87}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22}$/)}).strict()}).strict();
export function validatePushSubscription(input){
  const value=pushInput.parse(input),url=new URL(value.endpoint);
  const trusted=url.hostname==='fcm.googleapis.com'||url.hostname==='updates.push.services.mozilla.com'||url.hostname==='web.push.apple.com'||/^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname);
  if(!trusted||url.protocol!=='https:'||url.port||url.username||url.password||url.hash)throw new WorkspaceError('Unsupported browser push endpoint',400);
  return value;
}
export async function reviewNotificationConsent(db,userId){await db.query('INSERT INTO notification_consents(user_id) VALUES($1) ON CONFLICT(user_id) DO UPDATE SET version=1,reviewed_at=now()',[userId])}
export async function setPushSubscription(db,userId,input){
  const subscription=validatePushSubscription(input.subscription),mode=modeInput.parse(input.mode);
  return discoveryTransaction(db,async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['push-user:'+userId]);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['push-endpoint:'+subscription.endpoint]);
    let old=(await client.query('SELECT * FROM push_subscriptions WHERE endpoint=$1 FOR UPDATE',[subscription.endpoint])).rows[0];
    if(old&&old.user_id!==userId&&old.enabled)throw new WorkspaceError('This browser belongs to another account. Disable its notifications first.',409);
    if(mode==='matching'){
      const profile=(await client.query('SELECT payload FROM profiles WHERE user_id=$1',[userId])).rows[0]?.payload;
      if(!hasMatchingPreferences(profile?.matchingPreferences))throw new WorkspaceError('Set matching preferences before enabling notifications.',400);
    }
    if(old&&old.user_id!==userId){await client.query('UPDATE push_subscriptions SET endpoint=$2 WHERE id=$1',[old.id,'retired:'+old.id]);old=null;}
    if(!old||!old.enabled){const count=(await client.query('SELECT count(*)::int n FROM push_subscriptions WHERE user_id=$1 AND enabled=true',[userId])).rows[0].n;if(count>=10)throw new WorkspaceError('Disable a device before adding more notifications.',400)}
    const boundary=(await client.query('SELECT COALESCE(max(sequence),0) n FROM job_first_publications')).rows[0].n;
    const changed=!old||!old.enabled||old.user_id!==userId||old.mode!==mode||JSON.stringify(old.subscription)!==JSON.stringify(subscription);
    const id=old?.id||randomUUID();
    await client.query('INSERT INTO push_subscriptions(id,user_id,endpoint,subscription,mode,boundary) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,subscription=excluded.subscription,mode=excluded.mode,enabled=true,generation=push_subscriptions.generation+$7,boundary=CASE WHEN $7=1 THEN excluded.boundary ELSE push_subscriptions.boundary END,consented_at=CASE WHEN $7=1 THEN now() ELSE push_subscriptions.consented_at END,updated_at=now()',[id,userId,subscription.endpoint,subscription,mode,boundary,changed?1:0]);
    if(changed)await client.query("UPDATE push_deliveries SET status='suppressed' WHERE subscription_id=$1 AND status IN ('pending','retry')",[id]);
    return {id,enabled:true,mode};
  });
}
export async function disablePushSubscription(db,userId,id){
  z.string().uuid().parse(id);
  return discoveryTransaction(db,async client=>{
    const result=await client.query('UPDATE push_subscriptions SET enabled=false,generation=generation+1,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING id',[id,userId]);
    if(result.rows.length)await client.query("UPDATE push_deliveries SET status='suppressed' WHERE subscription_id=$1 AND status IN ('pending','retry')",[id]);
    return result.rows.length>0;
  });
}
/** @param {any} db @param {{publicationDay:string,limit?:number}} options */
export async function queuePushDigests(db,{publicationDay:day,limit=100}={}){
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(day);
  return discoveryTransaction(db,async client=>{
    const cutoff=await dailyCutoff(client,day);
    await client.query('INSERT INTO push_campaigns(publication_day,cutoff) VALUES($1,$2) ON CONFLICT DO NOTHING',[day,cutoff]);
    const campaign=(await client.query('SELECT * FROM push_campaigns WHERE publication_day=$1 FOR UPDATE',[day])).rows[0];
    if(campaign.complete)return {queued:0,complete:true};
    const size=Math.max(1,Math.min(limit,100));
    const devices=(await client.query('SELECT * FROM push_subscriptions WHERE enabled=true AND id::text>$1 ORDER BY id::text LIMIT $2 FOR UPDATE',[campaign.last_device,size])).rows;
    let queued=0;
    for(const device of devices){
      const jobs=await notificationJobs(client,{userId:device.user_id,boundary:device.boundary,cutoff:campaign.cutoff,mode:device.mode});
      if(jobs.length){
        const payload={title:'New jobs on FrontlaneJobs',body:jobs.length+' new frontend '+(jobs.length===1?'job matches':'jobs match')+' your '+(device.mode==='matching'?'preferences.':'job feed.'),count:jobs.length,url:'/inbox',tag:'frontlane-daily-'+day};
        queued+=(await client.query('INSERT INTO push_deliveries(id,subscription_id,publication_day,generation,payload,jobs) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id',[randomUUID(),device.id,day,device.generation,payload,jobs])).rows.length;
      }
      await client.query('UPDATE push_subscriptions SET boundary=GREATEST(boundary,$2) WHERE id=$1',[device.id,campaign.cutoff]);
    }
    const complete=devices.length<size;
    await client.query('UPDATE push_campaigns SET last_device=$2,complete=$3 WHERE publication_day=$1',[day,devices.at(-1)?.id||campaign.last_device,complete]);
    return {queued,complete};
  });
}
/** @param {any} db @param {{send?:Function,limit?:number,signal?:AbortSignal}} options */
export async function drainPushOutbox(db,{send,limit=20,signal}={}){
  const stats={accepted:0,retry:0,expired:0,suppressed:0,failed:0,ambiguous:0};
  if(!send)return stats;
  for(let i=0;i<Math.min(limit,100)&&!signal?.aborted;i++){
    const claim=randomUUID();
    const delivery=await discoveryTransaction(db,async client=>{
      const row=(await client.query("SELECT * FROM push_deliveries WHERE (status IN ('pending','retry') AND next_attempt_at<=now()) OR (status='sending' AND lease_until<now()) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0];
      if(!row)return null;
      const sub=(await client.query('SELECT * FROM push_subscriptions WHERE id=$1',[row.subscription_id])).rows[0];
      const status=!sub?.enabled||sub.generation!==row.generation?'suppressed':row.status==='sending'?'ambiguous':Date.now()-new Date(row.created_at).getTime()>48*3600000?'expired':null;
      if(status){await client.query('UPDATE push_deliveries SET status=$2 WHERE id=$1',[row.id,status]);stats[status]++;return {skip:true}}
      await client.query("UPDATE push_deliveries SET status='sending',claim_id=$2,lease_until=now()+interval '60 seconds',attempts=attempts+1 WHERE id=$1",[row.id,claim]);
      return {...row,subscription:sub.subscription};
    });
    if(!delivery)break;if(delivery.skip)continue;
    const current=(await db.query('SELECT enabled,generation FROM push_subscriptions WHERE id=$1',[delivery.subscription_id])).rows[0];
    if(!current?.enabled||current.generation!==delivery.generation){await db.query("UPDATE push_deliveries SET status='suppressed',lease_until=NULL WHERE id=$1 AND claim_id=$2",[delivery.id,claim]);stats.suppressed++;continue}
    if(signal?.aborted){await db.query("UPDATE push_deliveries SET status='retry',attempts=attempts-1,lease_until=NULL WHERE id=$1 AND claim_id=$2",[delivery.id,claim]);break}
    let status='accepted';
    try{await send(validatePushSubscription(delivery.subscription),delivery.payload,{signal})}
    catch(error){const code=Number(error.statusCode);status=[404,410].includes(code)?'expired':code===429||code>=500?'retry':code>=400?'failed':'ambiguous';if(delivery.attempts>=5&&status==='retry')status='failed'}
    await discoveryTransaction(db,async client=>{
      const result=await client.query("UPDATE push_deliveries SET status=$3,lease_until=NULL,next_attempt_at=now()+interval '15 minutes' WHERE id=$1 AND claim_id=$2 RETURNING subscription_id",[delivery.id,claim,status]);
      if(status==='expired'&&result.rows.length)await client.query('UPDATE push_subscriptions SET enabled=false,generation=generation+1 WHERE id=$1',[delivery.subscription_id]);
    });
    stats[status]++;
  }
  return stats;
}

/** @param {any} subscription @param {any} payload @param {{publicKey:string,privateKey:string,subject:string,signal?:AbortSignal,fetchImpl?:Function}} options */
export async function sendWebPush(subscription,payload,{publicKey,privateKey,subject,signal,fetchImpl=fetch}={}){
  signal?.throwIfAborted();
  const {default:webpush}=await import('web-push');
  const details=webpush.generateRequestDetails(validatePushSubscription(subscription),JSON.stringify(payload),{vapidDetails:{subject,publicKey,privateKey},TTL:3600,urgency:'normal',topic:payload.tag});
  const timeout=AbortSignal.timeout(8000);
  const response=await fetchImpl(details.endpoint,{method:details.method,headers:details.headers,body:details.body,redirect:'error',signal:signal?AbortSignal.any([signal,timeout]):timeout});
  if(!response.ok)throw Object.assign(new Error('Push provider rejected delivery'),{statusCode:response.status});
}
