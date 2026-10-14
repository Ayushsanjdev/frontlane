import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {register} from 'node:module';
import {Webhook} from '../apps/web/node_modules/svix/dist/index.mjs';
register('./helpers/route-loader.mjs',import.meta.url);
const route=await import('../apps/web/app/api/email-webhook/route.ts');
const secret='whsec_'+Buffer.from('test-secret-for-signed-webhooks').toString('base64');
test('unsigned webhook cannot suppress a recipient',async()=>{
  process.env.RESEND_WEBHOOK_SECRET=secret;globalThis.__frontlaneRouteTest={db:{query:()=>assert.fail('unsigned webhook must not access database')}};
  assert.equal((await route.POST(new Request('https://example.com/api/email-webhook',{method:'POST',body:'{}'}))).status,400);
});
test('signed bounce suppresses its known recipient and replay is harmless',async()=>{
  process.env.RESEND_WEBHOOK_SECRET=secret;const pg=new PGlite();for(const file of (await readdir(new URL('../packages/database/schema/',import.meta.url))).filter(v=>v.endsWith('.sql')).sort())await pg.exec(await readFile(new URL('../packages/database/schema/'+file,import.meta.url),'utf8'));
  globalThis.__frontlaneRouteTest={db:{query:(sql,args)=>pg.query(sql,args),connect:async()=>({query:(sql,args)=>pg.query(sql,args),release(){}})}};
  try{
    await pg.query("INSERT INTO digest_subscriptions(user_id,email,mode,enabled) VALUES('alice','alice@example.com','all',true)");
    await pg.query("INSERT INTO email_deliveries(id,user_id,publication_day,generation,recipient,mode,jobs,body,unsubscribe_hash,provider_id,status) VALUES('00000000-0000-4000-8000-000000000001','alice','2026-10-14',1,'alice@example.com','all','[]','{}','hash','provider-one','accepted')");
    const body=JSON.stringify({type:'email.bounced',data:{email_id:'provider-one'}}),id='msg_test',time=new Date(),signature=new Webhook(secret).sign(id,time,body);
    const request=()=>new Request('https://example.com/api/email-webhook',{method:'POST',headers:{'svix-id':id,'svix-timestamp':String(Math.floor(time.getTime()/1000)),'svix-signature':signature},body});
    assert.equal((await route.POST(request())).status,200);assert.equal((await route.POST(request())).status,200);
    const sub=(await pg.query("SELECT enabled,suppressed FROM digest_subscriptions WHERE user_id='alice'")).rows[0];assert.deepEqual(sub,{enabled:false,suppressed:true});
    assert.equal((await pg.query('SELECT count(*)::int AS n FROM email_webhook_receipts')).rows[0].n,1);
  }finally{await pg.close()}
});
