import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import * as transports from '../packages/core/src/email-transport.mjs';
import {drainDigestOutbox} from '../packages/core/src/email-digests.mjs';

test('Gmail sends a single recipient with unsubscribe headers and a stable message ID',async()=>{
  assert.equal(typeof transports.gmailTransport,'function');
  let message,config;
  const send=transports.gmailTransport('frontlanejobs@gmail.com','abcd efgh ijkl mnop',{createTransport:options=>{
    config=options;return {sendMail:async value=>{message=value;return {accepted:['member@example.com'],messageId:value.messageId}}};
  }});
  const result=await send({body:{from:'FrontlaneJobs <frontlanejobs@gmail.com>',to:['member@example.com'],subject:'New jobs',html:'<p>Jobs</p>',text:'Jobs',headers:{'List-Unsubscribe':'<https://example.com/unsubscribe>'},bcc:['unexpected@example.com']},idempotencyKey:'frontlane-digest/one'});
  assert.equal(config.host,'smtp.gmail.com');assert.equal(config.secure,true);assert.equal(config.auth.pass,'abcdefghijklmnop');
  assert.deepEqual(message.to,['member@example.com']);assert.equal(message.bcc,undefined);assert.equal(message.headers['List-Unsubscribe'],'<https://example.com/unsubscribe>');
  assert.equal(message.disableFileAccess,true);assert.equal(message.disableUrlAccess,true);assert.match(result.providerId,/@gmail.com>$/);
});

test('Gmail separates explicit rejections from uncertain delivery and never reports acceptance without an accepted recipient',async()=>{
  assert.equal(typeof transports.gmailTransport,'function');
  const delivery={body:{from:'frontlanejobs@gmail.com',to:['member@example.com']},idempotencyKey:'one'};
  for(const [failure,expected] of [[{responseCode:450},{ambiguous:false,permanent:false}],[{responseCode:550,command:'RCPT TO',response:'550 5.1.1 User does not exist'},{ambiguous:false,permanent:true,suppressRecipient:true}],[{responseCode:550,command:'RCPT TO',response:'550 5.7.1 Policy rejection'},{ambiguous:false,permanent:true,suppressRecipient:false}],[{responseCode:535,command:'AUTH'},{ambiguous:false,permanent:true,suppressRecipient:false}],[{code:'ETIMEDOUT'},{ambiguous:true,permanent:false}]]){
    const send=transports.gmailTransport('frontlanejobs@gmail.com','abcdefghijklmnop',{createTransport:()=>({sendMail:async()=>{throw failure}})});
    await assert.rejects(send(delivery),error=>Object.entries(expected).every(([key,value])=>error[key]===value));
  }
  const send=transports.gmailTransport('frontlanejobs@gmail.com','abcdefghijklmnop',{createTransport:()=>({sendMail:async()=>({accepted:[],messageId:'id'})})});
  await assert.rejects(send(delivery),error=>error.ambiguous===true);
});

async function fixture(){
  const pg=new PGlite();for(const file of (await readdir(new URL('../packages/database/schema/',import.meta.url))).filter(v=>v.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../packages/database/schema/'+file,import.meta.url),'utf8'));
  await pg.query("INSERT INTO digest_subscriptions(user_id,email,mode,enabled) VALUES('alice','alice@example.com','all',true)");
  const id='00000000-0000-4000-8000-000000000001';
  await pg.query("INSERT INTO email_deliveries(id,user_id,publication_day,generation,recipient,mode,jobs,body,unsubscribe_hash) VALUES($1,'alice','2026-10-15',1,'alice@example.com','all','[]','{}','hash')",[id]);
  return {pg,id,db:{query:(sql,args)=>pg.query(sql,args),connect:async()=>({query:(sql,args)=>pg.query(sql,args),release(){}})}};
}

test('uncertain Gmail sends and expired Gmail leases are held instead of retried',async()=>{
  const {pg,id,db}=await fixture();try{
    const stats=await drainDigestOutbox(db,{transportName:'gmail',transport:async()=>{throw {ambiguous:true}},paceMs:0,limit:1});
    assert.equal(stats.ambiguous,1);assert.equal((await pg.query('SELECT status FROM email_deliveries WHERE id=$1',[id])).rows[0].status,'ambiguous');
    await pg.query("UPDATE email_deliveries SET status='sending',lease_until=now()-interval '1 minute' WHERE id=$1",[id]);
    await drainDigestOutbox(db,{transportName:'gmail',transport:async()=>assert.fail('an uncertain Gmail attempt must never be resent'),paceMs:0});
    assert.equal((await pg.query('SELECT status FROM email_deliveries WHERE id=$1',[id])).rows[0].status,'ambiguous');
  }finally{await pg.close()}
});

test('Gmail retry attempts reserve a durable rolling daily budget and provider switches hold prior attempts',async()=>{
  const {pg,id,db}=await fixture();try{
    let calls=0;
    await drainDigestOutbox(db,{transportName:'gmail',gmailDailyLimit:1,transport:async()=>{calls++;throw {ambiguous:false}},paceMs:0,limit:1});
    await pg.query("UPDATE email_deliveries SET next_attempt_at=now()-interval '1 minute' WHERE id=$1",[id]);
    await drainDigestOutbox(db,{transportName:'gmail',gmailDailyLimit:1,transport:async()=>{calls++;return {providerId:'duplicate'}} ,paceMs:0});
    assert.equal(calls,1);assert.equal((await pg.query('SELECT count(*)::int AS n FROM gmail_send_attempts')).rows[0].n,1);
    await drainDigestOutbox(db,{transportName:'resend',transport:async()=>assert.fail('switching provider must not resend prior attempts'),paceMs:0});
    assert.equal((await pg.query('SELECT status FROM email_deliveries WHERE id=$1',[id])).rows[0].status,'ambiguous');
  }finally{await pg.close()}
});

test('a provider switch binds the configured sender before the first attempt and freezes it thereafter',async()=>{
  const {pg,id,db}=await fixture();try{
    await pg.query('UPDATE email_deliveries SET body=$2 WHERE id=$1',[id,{from:'frontlanejobs@gmail.com',to:['alice@example.com'],html:'content',headers:{'List-Unsubscribe':'<https://example.com/unsubscribe>'}}]);
    await drainDigestOutbox(db,{from:'jobs@verified.example.com',transport:async({body})=>{assert.equal(body.from,'jobs@verified.example.com');assert.equal(body.html,'content');throw {retryAfterMs:0}},paceMs:0,limit:1});
    await pg.query("UPDATE email_deliveries SET next_attempt_at=now()-interval '1 minute' WHERE id=$1",[id]);
    await drainDigestOutbox(db,{from:'different@verified.example.com',transport:async({body})=>{assert.equal(body.from,'jobs@verified.example.com');return {providerId:'success'}},paceMs:0,limit:1});
    assert.equal((await pg.query('SELECT status FROM email_deliveries WHERE id=$1',[id])).rows[0].status,'accepted');
  }finally{await pg.close()}
});
