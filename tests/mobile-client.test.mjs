import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApi,ApiError} from '../apps/mobile/src/api.mjs';
import {latestRequest,jobQuery,publicationAttempt} from '../apps/mobile/src/operations.mjs';

test('native requests omit browser cookies and send bearer credentials only to configured origin',async()=>{
 let called;
 const api=createApi('https://example.com/',async(url,options)=>{called={url,options};return Response.json({ok:true})});
 assert.deepEqual(await api.request('/api/profile',{token:'secret',method:'POST',body:{name:'Alice'}}),{ok:true});
 assert.equal(called.url,'https://example.com/api/profile');
 assert.equal(called.options.credentials,'omit');
 assert.equal(called.options.headers.Authorization,'Bearer secret');
 assert.equal(called.options.body,'{"name":"Alice"}');
 await assert.rejects(()=>api.request('//evil.example/api/profile',{token:'secret'}),/Invalid API path/);
});
test('unauthorized responses expire the captured session and useful server errors survive',async()=>{
 let expired=0;
 const api=createApi('https://example.com',async()=>Response.json({error:'Sign in required'},{status:401}));
 await assert.rejects(()=>api.request('/api/profile',{token:'old',onUnauthorized:()=>expired++}),error=>error instanceof ApiError&&error.status===401);
 assert.equal(expired,1);
 const unavailable=createApi('https://example.com',async()=>{throw Error('network')});
 await assert.rejects(()=>unavailable.request('/api/jobs'),/connection/);
});
test('latest-request guard aborts stale work even when a transport ignores abort',()=>{
 const guard=latestRequest();
 const first=guard.begin(),second=guard.begin();
 assert.equal(first.signal.aborted,true);
 assert.equal(first.current(),false);
 assert.equal(second.current(),true);
 guard.cancel();assert.equal(second.current(),false);
});
test('job filtering includes every server query and publication retries retain identity',()=>{
 const query=jobQuery({q:'React & Next',type:'Contract',mode:'Remote',stack:'React',sort:'newest',page:2});
 const params=new URLSearchParams(query);
 assert.equal(params.get('q'),'React & Next');assert.equal(params.get('page'),'2');assert.equal(params.get('limit'),'12');
 const attempt=publicationAttempt(()=> 'id-'+Math.random());
 const a=attempt.get({title:'Frontend'}),b=attempt.get({title:'Frontend'}),c=attempt.get({title:'Engineer'});
 assert.equal(a.submissionId,b.submissionId);assert.notEqual(a.submissionId,c.submissionId);
});

test('Google URL forwarding preserves React Native links and is idempotent',async()=>{
 const {createRequire}=await import('node:module');
 const {forwardGoogleUrls}=createRequire(import.meta.url)('../apps/mobile/plugins/with-google-redirect.cjs');
 const source='import Expo\nreturn super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)';
 const updated=forwardGoogleUrls(source);
 assert.match(updated,/import GoogleSignIn/);
 assert.match(updated,/if GIDSignIn.sharedInstance.handle\(url\) \{ return true \}/);
 assert.ok(updated.includes(source.split('\n')[1]));
 assert.equal(forwardGoogleUrls(updated),updated);
 assert.throws(()=>forwardGoogleUrls('changed template'),/requires/);
});

test('production client requires HTTPS while development can use LAN HTTP',async()=>{
 const transport=async()=>Response.json({ok:true});
 await assert.rejects(()=>createApi('http://192.168.1.10:3000',transport).request('/api/profile',{token:'secret'}),/HTTPS/);
 assert.deepEqual(await createApi('http://localhost:3000',transport,{allowHttp:true}).request('/api/jobs'),{ok:true});
});
