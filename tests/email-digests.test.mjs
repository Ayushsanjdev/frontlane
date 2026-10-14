import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {setDigestSubscription,queueDailyDigests,drainDigestOutbox,unsubscribeDigest} from '../packages/core/src/email-digests.mjs';
const seed=JSON.parse(await readFile(new URL(import.meta.resolve('@frontlanejobs/database/seed')),'utf8'));
async function database(){const pg=new PGlite();for(const file of (await readdir(new URL('../packages/database/schema/',import.meta.url))).filter(v=>v.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../packages/database/schema/'+file,import.meta.url),'utf8'));return {pg,db:{query:(sql,args)=>pg.query(sql,args),connect:async()=>({query:(sql,args)=>pg.query(sql,args),release(){}})}}}
test('daily digests contain only new jobs, both modes work, and retries do not create a second delivery',async()=>{
  const {pg,db}=await database();try{
    await pg.query('INSERT INTO profiles(user_id,payload) VALUES($1,$2)',['alice',{matchingPreferences:{skills:['React'],roles:[],cities:[],arrangements:[],types:[]}}]);
    await setDigestSubscription(db,{userId:'alice',verifiedEmail:'alice@example.com',enabled:true,mode:'matching'});
    await setDigestSubscription(db,{userId:'bob',verifiedEmail:'bob@example.com',enabled:true,mode:'all'});
    const job={...seed[0],id:'new-job',tags:['React']};
    await pg.query('INSERT INTO jobs(id,source,canonical_url,payload) VALUES($1,$2,$3,$4)',[job.id,job.source,job.url,job]);
    await pg.query('INSERT INTO job_first_publications(canonical_url,job_id) VALUES($1,$2)',[job.url,job.id]);
    await queueDailyDigests(db,{publicationDay:'2026-10-14',from:'jobs@example.com',appUrl:'https://example.com'});
    await queueDailyDigests(db,{publicationDay:'2026-10-14',from:'jobs@example.com',appUrl:'https://example.com'});
    const deliveries=(await pg.query('SELECT * FROM email_deliveries ORDER BY user_id')).rows;assert.equal(deliveries.length,2);
    const bodies=[];await drainDigestOutbox(db,{transport:async delivery=>{bodies.push(delivery.body);return {providerId:'provider-'+bodies.length}},paceMs:0,limit:5});
    assert.equal(bodies.length,2);assert.ok(bodies[0].html.includes(job.title));
    await drainDigestOutbox(db,{transport:async()=>assert.fail('accepted delivery must not be sent again'),paceMs:0});
    const link=bodies.find(body=>body.to[0]==='alice@example.com').headers['List-Unsubscribe'].slice(1,-1);const token=new URL(link).searchParams.get('token');
    await setDigestSubscription(db,{userId:'alice',verifiedEmail:'alice@example.com',enabled:true,mode:'all'});
    assert.ok(token);assert.equal(await unsubscribeDigest(db,token),true);
    assert.equal((await pg.query("SELECT enabled FROM digest_subscriptions WHERE user_id='alice'")).rows[0].enabled,false);
  }finally{await pg.close()}
});
test('matching subscriptions require preferences and arbitrary malformed recipient addresses are rejected',async()=>{
  const {pg,db}=await database();try{await assert.rejects(setDigestSubscription(db,{userId:'alice',verifiedEmail:'alice@example.com',enabled:true,mode:'matching'}),/preferences/);await assert.rejects(setDigestSubscription(db,{userId:'alice',verifiedEmail:'not-an-email',enabled:true,mode:'all'}));}finally{await pg.close()}
});
