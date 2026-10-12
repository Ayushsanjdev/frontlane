import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/route-loader.mjs',import.meta.url);
const {authCallbacks}=await import('../apps/web/src/lib/server/auth-policy.ts');

test('Google sign-in requires a verified email and preserves existing account ownership keys',async()=>{
  assert.equal(await authCallbacks.signIn({account:{provider:'google'},profile:{email_verified:true}}),true);
  for(const profile of [{email_verified:false},{email_verified:'true'},{}]){
    assert.equal(await authCallbacks.signIn({account:{provider:'google'},profile}),false);
  }
  assert.equal(await authCallbacks.signIn({account:{provider:'other'},profile:{email_verified:true}}),false);
  const token=await authCallbacks.jwt({token:{},account:{providerAccountId:'12345'}});
  assert.equal(token.userId,'google:12345');
  const session=await authCallbacks.session({session:{user:{name:'Alice'}},token});
  assert.equal(session.user.id,'google:12345');
  assert.equal((await authCallbacks.jwt({token,account:null})).userId,'google:12345');
});
test('authentication redirects stay on the application origin',async()=>{
  const baseUrl='https://frontlanejobs.example';
  for(const url of ['https://evil.example','//evil.example','/\\evil.example','https://frontlanejobs.example.evil.example','/jobs\n']){
    assert.equal(await authCallbacks.redirect({url,baseUrl}),baseUrl+'/tracker');
  }
  assert.equal(await authCallbacks.redirect({url:'/jobs?job=abc',baseUrl}),baseUrl+'/jobs?job=abc');
  assert.equal(await authCallbacks.redirect({url:baseUrl+'/account',baseUrl}),baseUrl+'/account');
});
