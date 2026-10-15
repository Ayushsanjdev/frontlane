import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {setPushSubscription,disablePushSubscription,queuePushDigests,drainPushOutbox,reviewNotificationConsent,dailyNotificationWindow,validatePushSubscription} from '../packages/core/src/push-notifications.mjs';
import {ingest} from '@frontlanejobs/core/ingestion';
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test-endpoint',keys:{p256dh:Buffer.alloc(65,1).toString('base64url'),auth:Buffer.alloc(16,2).toString('base64url')}};
async function fixture(){const pg=new PGlite();for(const file of (await readdir(new URL('../packages/database/schema/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../packages/database/schema/'+file,import.meta.url),'utf8'));return {pg,db:{query:(sql,args)=>pg.query(sql,args),connect:async()=>({query:(sql,args)=>pg.query(sql,args),release(){}})}}}
const job={title:'Frontend Engineer',company:'Example',location:'India',mode:'Remote',type:'Full-time',salary:'Unknown',tags:['React'],experience:'Unknown',summary:'Build React interfaces.',caveat:'Review employer',url:'https://example.com/jobs/new',checked:new Date().toISOString(),posted:null,eligibility:'India',degree:'Unknown'};
test('daily window starts at 08:00 IST and unsafe subscription endpoints are rejected',()=>{
  assert.equal(dailyNotificationWindow(new Date('2026-10-15T02:29:00Z')),null);
  assert.equal(dailyNotificationWindow(new Date('2026-10-15T02:30:00Z')),'2026-10-15');
  assert.equal(dailyNotificationWindow(new Date('2026-10-15T18:30:00Z')),null);
  assert.doesNotThrow(()=>validatePushSubscription(subscription));
  for(const endpoint of ['http://fcm.googleapis.com/test','https://127.0.0.1/test','https://fcm.googleapis.com.attacker.example/test','https://user:pass@fcm.googleapis.com/test','https://fcm.googleapis.com:8443/test'])assert.throws(()=>validatePushSubscription({...subscription,endpoint}));
});
test('consent is reviewed once; matching push requires preferences and respects account/device ownership',async()=>{
  const {pg,db}=await fixture();try{
  await reviewNotificationConsent(db,'alice');await reviewNotificationConsent(db,'alice');
  assert.equal((await pg.query('SELECT count(*)::int n FROM notification_consents')).rows[0].n,1);
  await assert.rejects(setPushSubscription(db,'alice',{subscription,mode:'matching'}),/preferences/);
  await pg.query('INSERT INTO profiles(user_id,payload) VALUES($1,$2)',['alice',{matchingPreferences:{skills:['React']}}]);
  const result=await setPushSubscription(db,'alice',{subscription,mode:'matching'});
  await assert.rejects(setPushSubscription(db,'bob',{subscription,mode:'all'}),/another account/);
  assert.equal(await disablePushSubscription(db,'bob',result.id),false);
  assert.equal(await disablePushSubscription(db,'alice',result.id),true);
  }finally{await pg.close()}
});
test('push campaigns send only new matching jobs once, omit hidden jobs, and disabling cancels queued work',async()=>{
  const {pg,db}=await fixture();try{
  await pg.query('INSERT INTO profiles(user_id,payload) VALUES($1,$2)',['alice',{matchingPreferences:{skills:['React']}}]);
  const sub=await setPushSubscription(db,'alice',{subscription,mode:'matching'});
  await ingest({source:'research:push',runId:'push-publish-1',jobs:[job,{...job,title:'Vue Engineer',tags:['Vue'],url:'https://example.com/jobs/vue'}]},db);
  await queuePushDigests(db,{publicationDay:'2026-10-15'});await queuePushDigests(db,{publicationDay:'2026-10-15'});
  assert.equal((await pg.query('SELECT count(*)::int n FROM push_deliveries')).rows[0].n,1);
  let sent=0;await drainPushOutbox(db,{send:async(s,payload)=>{sent++;assert.equal(s.endpoint,subscription.endpoint);assert.equal(payload.count,1);assert.equal(payload.url,'/inbox');},limit:10});
  await drainPushOutbox(db,{send:async()=>assert.fail('duplicate delivery')});assert.equal(sent,1);
  await queuePushDigests(db,{publicationDay:'2026-10-16'});assert.equal((await pg.query('SELECT count(*)::int n FROM push_deliveries')).rows[0].n,1);
  await ingest({source:'research:push',runId:'push-publish-2',jobs:[{...job,url:'https://example.com/jobs/next'}]},db);
  await queuePushDigests(db,{publicationDay:'2026-10-17'});await disablePushSubscription(db,'alice',sub.id);
  await drainPushOutbox(db,{send:async()=>assert.fail('disabled subscription')});
  assert.equal((await pg.query("SELECT status FROM push_deliveries WHERE publication_day='2026-10-17'")).rows[0].status,'suppressed');
  }finally{await pg.close()}
});
test('expired subscriptions are disabled and transient failures retry without duplicating campaigns',async()=>{
  const {pg,db}=await fixture();try{
  await setPushSubscription(db,'alice',{subscription,mode:'all'});
  await ingest({source:'research:push',runId:'push-expired-1',jobs:[job]},db);await queuePushDigests(db,{publicationDay:'2026-10-15'});
  await drainPushOutbox(db,{send:async()=>{throw Object.assign(new Error('gone'),{statusCode:410})}});
  assert.equal((await pg.query('SELECT enabled FROM push_subscriptions')).rows[0].enabled,false);
  assert.equal((await pg.query('SELECT status FROM push_deliveries')).rows[0].status,'expired');
  }finally{await pg.close()}
});
test('reviewing the prompt does not enroll users, hidden jobs are excluded, and both channels share a cutoff',async()=>{
  const {pg,db}=await fixture();try{
  const {queueDailyDigests,setDigestSubscription}=await import('../packages/core/src/email-digests.mjs');
  await reviewNotificationConsent(db,'alice');assert.equal((await pg.query('SELECT count(*)::int n FROM push_subscriptions')).rows[0].n,0);
  await setPushSubscription(db,'alice',{subscription,mode:'all'});await setDigestSubscription(db,{userId:'alice',verifiedEmail:'alice@example.com',enabled:true,mode:'all'});
  await ingest({source:'research:push',runId:'push-shared-cutoff-1',jobs:[job]},db);
  await queueDailyDigests(db,{publicationDay:'2026-10-15',from:'jobs@example.com',appUrl:'https://example.com'});
  await ingest({source:'research:push',runId:'push-shared-cutoff-2',jobs:[{...job,url:'https://example.com/jobs/later'}]},db);
  await queuePushDigests(db,{publicationDay:'2026-10-15'});
  assert.equal((await pg.query('SELECT payload FROM push_deliveries')).rows[0].payload.count,1);
  await pg.query("INSERT INTO job_feedback(user_id,kind,target) VALUES('alice','company','example')");
  await queuePushDigests(db,{publicationDay:'2026-10-16'});assert.equal((await pg.query('SELECT count(*)::int n FROM push_deliveries')).rows[0].n,1);
  }finally{await pg.close()}
});
test('temporary failures retry while abandoned send leases are not dispatched twice',async()=>{
  const {pg,db}=await fixture();try{
  await setPushSubscription(db,'alice',{subscription,mode:'all'});await ingest({source:'research:push',runId:'push-retry-001',jobs:[job]},db);await queuePushDigests(db,{publicationDay:'2026-10-15'});
  const first=await drainPushOutbox(db,{send:async()=>{throw Object.assign(new Error('busy'),{statusCode:503})}});assert.equal(first.retry,1);
  await pg.query("UPDATE push_deliveries SET next_attempt_at=now()-interval '1 minute'");let sent=0;
  await drainPushOutbox(db,{send:async()=>{sent++}});assert.equal(sent,1);
  await pg.query("UPDATE push_deliveries SET status='sending',lease_until=now()-interval '1 minute'");
  const result=await drainPushOutbox(db,{send:async()=>assert.fail('uncertain previous dispatch')});assert.equal(result.ambiguous,1);
  }finally{await pg.close()}
});
test('re-enabling a disabled device cannot bypass the enabled device cap',async()=>{
  const {pg,db}=await fixture();try{
  const old=await setPushSubscription(db,'alice',{subscription,mode:'all'});await disablePushSubscription(db,'alice',old.id);
  for(let i=0;i<10;i++)await setPushSubscription(db,'alice',{subscription:{...subscription,endpoint:subscription.endpoint+'-'+i},mode:'all'});
  await assert.rejects(setPushSubscription(db,'alice',{subscription,mode:'all'}),/Disable a device/);
  }finally{await pg.close()}
});
test('disabling after claim suppresses the pending dispatch',async()=>{
  const {pg,db}=await fixture();try{
  const sub=await setPushSubscription(db,'alice',{subscription,mode:'all'});await ingest({source:'research:push',runId:'push-race-001',jobs:[job]},db);await queuePushDigests(db,{publicationDay:'2026-10-15'});
  let claimed=false,revoked=false;
  const raced={...db,connect:async()=>{const client=await db.connect();return {...client,query:async(sql,args)=>{if(sql.includes("SET status='sending'"))claimed=true;const result=await client.query(sql,args);if(sql==='COMMIT'&&claimed&&!revoked){revoked=true;await disablePushSubscription(db,'alice',sub.id)}return result}}}};
  await drainPushOutbox(raced,{send:async()=>assert.fail('must recheck consent before sending')});
  assert.equal((await pg.query('SELECT status FROM push_deliveries')).rows[0].status,'suppressed');
  }finally{await pg.close()}
});
test('reusing a signed-out browser preserves the previous account delivery ownership',async()=>{
  const {pg,db}=await fixture();try{
  const alice=await setPushSubscription(db,'alice',{subscription,mode:'all'});await ingest({source:'research:push',runId:'push-transfer-001',jobs:[job]},db);await queuePushDigests(db,{publicationDay:'2026-10-15'});await drainPushOutbox(db,{send:async()=>{}});await disablePushSubscription(db,'alice',alice.id);
  const bob=await setPushSubscription(db,'bob',{subscription,mode:'all'});assert.notEqual(bob.id,alice.id);
  assert.equal((await pg.query("SELECT count(*)::int n FROM push_deliveries d JOIN push_subscriptions s ON s.id=d.subscription_id WHERE s.user_id='bob'")).rows[0].n,0);
  assert.equal((await pg.query('SELECT user_id FROM push_subscriptions WHERE id=$1',[alice.id])).rows[0].user_id,'alice');
  }finally{await pg.close()}
});
test('encrypted push transport honors cancellation and never follows provider redirects',async()=>{
  const {sendWebPush}=await import('../packages/core/src/push-notifications.mjs');const {createECDH}=await import('node:crypto');
  const vapid=createECDH('prime256v1');vapid.generateKeys();const receiver=createECDH('prime256v1');receiver.generateKeys();
  const valid={...subscription,keys:{...subscription.keys,p256dh:receiver.getPublicKey().toString('base64url')}};
  const controller=new AbortController();
  const options={publicKey:vapid.getPublicKey().toString('base64url'),privateKey:vapid.getPrivateKey().toString('base64url'),subject:'https://example.com',signal:controller.signal,fetchImpl:async(url,init)=>{assert.equal(url,subscription.endpoint);assert.equal(init.redirect,'error');assert.equal(init.signal.aborted,false);assert.ok(init.body.length>0);assert.equal(JSON.stringify(init.headers).includes(vapid.getPrivateKey().toString('base64url')),false);return {ok:true}}};
  await sendWebPush(valid,{tag:'frontlane-daily-2026-10-15',count:1},options);
  controller.abort();await assert.rejects(sendWebPush(valid,{tag:'frontlane-daily-2026-10-15'}, {...options,fetchImpl:()=>assert.fail('aborted transport must not dispatch')}));
});
