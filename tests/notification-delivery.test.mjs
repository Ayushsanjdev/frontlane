import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/route-loader.mjs',import.meta.url);
const {processDailyNotifications}=await import('../apps/web/lib/daily-notifications.ts');
test('push processing remains available when email is unconfigured and vice versa',async()=>{
  const keys=['NOTIFICATION_APP_URL','APP_URL','EMAIL_PROVIDER','GMAIL_USER','GMAIL_APP_PASSWORD','RESEND_API_KEY','EMAIL_FROM','RESEND_WEBHOOK_SECRET','NEXT_PUBLIC_VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT'];
  const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try{
  for(const key of keys)delete process.env[key];Object.assign(process.env,{NOTIFICATION_APP_URL:'https://example.com',NEXT_PUBLIC_VAPID_PUBLIC_KEY:'A'.repeat(87),VAPID_PRIVATE_KEY:'B'.repeat(43),VAPID_SUBJECT:'https://example.com'});
  const query=async()=>({rows:[]});globalThis.__frontlaneRouteTest={db:{query,connect:async()=>({query,release(){}})}};
  let result=await processDailyNotifications({budgetMs:1000});assert.equal(result.email.available,false);assert.equal(result.push.available,true);assert.equal(result.push.accepted,0);
  delete process.env.VAPID_PRIVATE_KEY;Object.assign(process.env,{EMAIL_PROVIDER:'gmail',GMAIL_USER:'frontlanejobs@gmail.com',GMAIL_APP_PASSWORD:'abcdefghijklmnop'});
  result=await processDailyNotifications({budgetMs:1000});assert.equal(result.email.available,true);assert.equal(result.push.available,false);assert.equal(result.email.accepted,0);
  }finally{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}}
});
