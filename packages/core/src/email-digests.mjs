import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import {discoveryTransaction} from './discovery-store.mjs';
import {hasMatchingPreferences,rankRecommendations} from './recommendations.mjs';
import {renderDigest} from './email-template.mjs';
import {WorkspaceError} from './tracker-store.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function publicationDay(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export async function setDigestSubscription(db,input){
  const value=z.object({userId:z.string().min(1),verifiedEmail:z.string().email().max(320),enabled:z.boolean(),mode:z.enum(['matching','all']).default('matching')}).strict().parse(input);
  return discoveryTransaction(db,async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['digest-subscription:'+value.userId]);
    const existing=(await client.query('SELECT * FROM digest_subscriptions WHERE user_id=$1 FOR UPDATE',[value.userId])).rows[0];
    if(existing?.suppressed&&value.enabled&&existing.email===value.verifiedEmail)throw new WorkspaceError('Email delivery is suppressed for this address. Contact support before enabling it.',400);
    if(value.enabled&&value.mode==='matching'){
      const profile=(await client.query('SELECT payload FROM profiles WHERE user_id=$1',[value.userId])).rows[0]?.payload;
      if(!hasMatchingPreferences(profile?.matchingPreferences))throw new WorkspaceError('Set matching preferences before enabling matching emails.',400);
    }
    const changed=!existing||existing.enabled!==value.enabled||existing.mode!==value.mode||existing.email!==value.verifiedEmail;
    const boundary=(await client.query('SELECT COALESCE(max(sequence),0) AS n FROM job_first_publications')).rows[0].n;
    const result=await client.query('INSERT INTO digest_subscriptions(user_id,email,enabled,mode,boundary) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,enabled=excluded.enabled,mode=excluded.mode,generation=digest_subscriptions.generation+$6,boundary=CASE WHEN $6=1 THEN excluded.boundary ELSE digest_subscriptions.boundary END,suppressed=CASE WHEN digest_subscriptions.email<>excluded.email THEN false ELSE digest_subscriptions.suppressed END RETURNING user_id,email,enabled,mode',[value.userId,value.verifiedEmail,value.enabled,value.mode,boundary,changed?1:0]);
    if(changed)await client.query("UPDATE email_deliveries SET status='suppressed' WHERE user_id=$1 AND status IN ('pending','retry')",[value.userId]);
    return result.rows[0];
  });
}
export async function queueDailyDigests(db,{publicationDay:day=publicationDay(),from,appUrl,limit=100}={}){
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(day);if(!from||!appUrl)throw new WorkspaceError('Email delivery is unavailable',503);
  return discoveryTransaction(db,async client=>{
    const cutoff=(await client.query('SELECT COALESCE(max(sequence),0) AS n FROM job_first_publications')).rows[0].n;
    await client.query('INSERT INTO digest_campaigns(publication_day,cutoff) VALUES($1,$2) ON CONFLICT DO NOTHING',[day,cutoff]);
    const campaign=(await client.query('SELECT * FROM digest_campaigns WHERE publication_day=$1 FOR UPDATE',[day])).rows[0];
    if(campaign.complete)return {queued:0,complete:true};
    const subscriptions=(await client.query('SELECT * FROM digest_subscriptions WHERE enabled=true AND suppressed=false AND user_id>$1 ORDER BY user_id LIMIT $2 FOR UPDATE',[campaign.last_user,Math.min(limit,100)])).rows;
    let queued=0;
    for(const sub of subscriptions){
      const rows=(await client.query("SELECT p.sequence,j.payload FROM job_first_publications p JOIN LATERAL (SELECT payload FROM jobs WHERE canonical_url=p.canonical_url AND active=true ORDER BY (source='community'),discovered_at DESC LIMIT 1) j ON true WHERE p.sequence>$1 AND p.sequence<=$2 AND p.baseline=false ORDER BY p.sequence",[sub.boundary,campaign.cutoff])).rows;
      const feedback=(await client.query('SELECT kind,target FROM job_feedback WHERE user_id=$1',[sub.user_id])).rows;
      let jobs=rows.map(row=>row.payload).filter(job=>!feedback.some(row=>row.kind==='job'&&row.target===job.id||row.kind==='company'&&row.target===job.company.toLowerCase()));
      if(sub.mode==='matching'){const profile=(await client.query('SELECT payload FROM profiles WHERE user_id=$1',[sub.user_id])).rows[0]?.payload;jobs=hasMatchingPreferences(profile?.matchingPreferences)?rankRecommendations(jobs,profile.matchingPreferences,feedback).filter(job=>job.matchReasons.length>0):[]}
      if(jobs.length){
        const id=randomUUID(),token=randomBytes(32).toString('base64url'),body=renderDigest({id,email:sub.email,jobs,token,publicationDay:day,mode:sub.mode},{appUrl,from});
        const result=await client.query('INSERT INTO email_deliveries(id,user_id,publication_day,generation,recipient,mode,jobs,body,unsubscribe_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id,publication_day) DO NOTHING RETURNING id',[id,sub.user_id,day,sub.generation,sub.email,sub.mode,jobs,body,hash(token)]);queued+=result.rows.length;
      }
      await client.query('UPDATE digest_subscriptions SET boundary=$2 WHERE user_id=$1',[sub.user_id,campaign.cutoff]);
    }
    const complete=subscriptions.length<Math.min(limit,100);
    await client.query('UPDATE digest_campaigns SET last_user=$2,complete=$3 WHERE publication_day=$1',[day,subscriptions.at(-1)?.user_id||campaign.last_user,complete]);
    return {queued,complete};
  });
}
/** @param {any} db @param {{transport?:Function,now?:Date,limit?:number,paceMs?:number,signal?:AbortSignal}} options */
export async function drainDigestOutbox(db,{transport,now=new Date(),limit=20,paceMs=1000,signal}={}){
  const stats={accepted:0,failed:0,retry:0,ambiguous:0,suppressed:0,expired:0};
  if(!transport)return stats;
  for(let index=0;index<Math.min(limit,100);index++){
    if(signal?.aborted)break;
    const current=new Date(Math.max(now.getTime(),Date.now())),claim=randomUUID();
    const row=await discoveryTransaction(db,async client=>{
      const candidate=(await client.query("SELECT * FROM email_deliveries WHERE (status IN ('pending','retry') AND next_attempt_at<=$1 OR status='sending' AND lease_until<$1) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1",[current])).rows[0];
      if(!candidate)return null;
      const sub=(await client.query('SELECT enabled,suppressed,generation,email FROM digest_subscriptions WHERE user_id=$1',[candidate.user_id])).rows[0];
      let status;
      if(!sub?.enabled||sub.suppressed||sub.generation!==candidate.generation||sub.email!==candidate.recipient)status='suppressed';
      else if(candidate.first_attempt_at&&current.getTime()-new Date(candidate.first_attempt_at).getTime()>=23*3600000)status='ambiguous';
      else if(!candidate.first_attempt_at&&current.getTime()-new Date(candidate.created_at).getTime()>48*3600000)status='expired';
      if(status){await client.query('UPDATE email_deliveries SET status=$2 WHERE id=$1',[candidate.id,status]);stats[status]++;return {skip:true}}
      return (await client.query("UPDATE email_deliveries SET status='sending',claim_id=$2,lease_until=$3,first_attempt_at=COALESCE(first_attempt_at,$4),attempts=attempts+1 WHERE id=$1 RETURNING *",[candidate.id,claim,new Date(current.getTime()+30000),current])).rows[0];
    });
    if(!row)break;if(row.skip)continue;
    try{
      const check=(await db.query('SELECT enabled,suppressed,generation FROM digest_subscriptions WHERE user_id=$1',[row.user_id])).rows[0];
      if(!check?.enabled||check.suppressed||check.generation!==row.generation){await db.query("UPDATE email_deliveries SET status='suppressed' WHERE id=$1 AND claim_id=$2",[row.id,claim]);stats.suppressed++;continue}
      const result=await transport({body:row.body,idempotencyKey:'frontlane-digest/'+row.id,signal});
      if(!result?.providerId)throw Error('Invalid email provider response');
      await db.query("UPDATE email_deliveries SET status='accepted',provider_id=$3,lease_until=NULL,last_error=NULL WHERE id=$1 AND claim_id=$2",[row.id,claim,result.providerId]);stats.accepted++;
    }catch(error){
      const permanent=error?.permanent===true,status=permanent?'failed':'retry',delays=[60000,300000,900000,3600000];
      const delay=Math.max(delays[Math.min(row.attempts-1,3)],error?.retryAfterMs||0);
      await db.query('UPDATE email_deliveries SET status=$3,next_attempt_at=$4,last_error=$5,lease_until=NULL WHERE id=$1 AND claim_id=$2',[row.id,claim,status,new Date(current.getTime()+delay),permanent?'Permanent provider rejection':'Temporary or uncertain provider failure']);stats[status]++;
      if(error?.suppressRecipient)await db.query('UPDATE digest_subscriptions SET suppressed=true,enabled=false WHERE user_id=$1 AND email=$2',[row.user_id,row.recipient]);
    }
    if(paceMs&&index<limit-1&&!signal?.aborted)await new Promise(resolve=>{const timer=setTimeout(resolve,paceMs);signal?.addEventListener('abort',()=>{clearTimeout(timer);resolve()},{once:true})});
  }
  return stats;
}
export async function unsubscribeDigest(db,token){
  if(typeof token!=='string'||!/^[\w-]{43}$/.test(token))return false;
  return discoveryTransaction(db,async client=>{
    const row=(await client.query('SELECT d.user_id FROM email_deliveries d JOIN digest_subscriptions s ON s.user_id=d.user_id AND s.email=d.recipient WHERE d.unsubscribe_hash=$1',[hash(token)])).rows[0];if(!row)return false;
    await client.query('UPDATE digest_subscriptions SET enabled=false WHERE user_id=$1',[row.user_id]);
    await client.query("UPDATE email_deliveries SET status='suppressed' WHERE user_id=$1 AND status IN ('pending','retry')",[row.user_id]);return true;
  });
}
