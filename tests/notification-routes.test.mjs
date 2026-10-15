import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/route-loader.mjs',import.meta.url);
const preferences=await import('../apps/web/app/api/notification-preferences/route.ts');
const push=await import('../apps/web/app/api/push-subscription/route.ts');
test('notification endpoints require sign-in and protect mutations against foreign origins',async()=>{
  globalThis.__frontlaneRouteTest={db:{query:()=>assert.fail('must not access database')},user:null};
  assert.equal((await preferences.GET(new Request('http://localhost:3000/api/notification-preferences'))).status,401);
  assert.equal((await push.DELETE(new Request('http://localhost:3000/api/push-subscription',{method:'DELETE',headers:{origin:'http://localhost:3000'}}))).status,401);
  process.env.APP_URL='https://frontlane.example';globalThis.__frontlaneRouteTest.user={userId:'alice',email:'alice@example.com'};
  for(const [handler,url,method] of [[preferences.POST,'notification-preferences','POST'],[push.POST,'push-subscription','POST'],[push.DELETE,'push-subscription','DELETE']])assert.equal((await handler(new Request('https://frontlane.example/api/'+url,{method,headers:{origin:'https://attacker.example'}}))).status,403);
  assert.equal((await preferences.GET(new Request('https://frontlane.example/api/notification-preferences',{headers:{authorization:'Bearer bad'}}))).status,401);
});
test('notification settings preserve existing email consent and only expose the current user device',async()=>{
  const calls=[];globalThis.__frontlaneRouteTest={user:{userId:'alice',email:'alice@example.com'},db:{query:async(sql,args)=>{calls.push({sql,args});return {rows:sql.includes('notification_consents')?[{version:1}]:sql.includes('FROM profiles')?[{payload:{matchingPreferences:{skills:['React']}}}]:sql.includes('digest_subscriptions')?[{enabled:true,email:'alice@example.com',mode:'matching'}]:[{enabled:true,mode:'all'}]}}}};
  const id='00000000-0000-4000-8000-000000000001';
  const response=await preferences.GET(new Request('https://frontlane.example/api/notification-preferences',{headers:{cookie:'frontlane-push-device='+id}}));
  const result=await response.json();assert.equal(response.status,200);assert.equal(result.reviewed,true);assert.equal(result.email.enabled,true);assert.equal(result.hasPreferences,true);
  assert.deepEqual(calls.find(c=>c.sql.includes('FROM push_subscriptions')).args,[id,'alice']);
  assert.equal(JSON.stringify(result).includes('privateKey'),false);
});
