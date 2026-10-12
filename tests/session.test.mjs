import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/session-loader.mjs',import.meta.url);
const {getUser,requireUser,signInPath}=await import('../apps/web/src/lib/server/session.ts');
const {load:loadLayout}=await import('../apps/web/src/routes/+layout.server.ts');
const previous={AUTH_SECRET:process.env.AUTH_SECRET,NEXTAUTH_SECRET:process.env.NEXTAUTH_SECRET};
after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}});

test('unconfigured auth permits anonymous pages and redirects private pages without calling Auth.js',async()=>{
  delete process.env.NEXTAUTH_SECRET;
  process.env.AUTH_SECRET='';
  globalThis.__sessionFixture={auth:async()=>{assert.fail('Auth.js must not run without a secret')}};
  assert.equal(await getUser({auth:()=>globalThis.__sessionFixture.auth()}),null);
  await assert.rejects(requireUser({auth:()=>globalThis.__sessionFixture.auth()},'/tracker'),/Redirect: \/signin\?returnTo=%2Ftracker/);
});
test('configured auth preserves the authenticated identity and propagates unexpected failures',async()=>{
  process.env.AUTH_SECRET='session-fixture-secret';
  globalThis.__sessionFixture={auth:async()=>({user:{id:'google:123',name:'Alice',email:'alice@example.com'}})};
  assert.deepEqual(await getUser({auth:()=>globalThis.__sessionFixture.auth()}),{userId:'google:123',displayName:'Alice',fullName:'Alice',email:'alice@example.com'});
  globalThis.__sessionFixture.auth=async()=>{throw Error('Unexpected auth failure')};
  await assert.rejects(getUser({auth:()=>globalThis.__sessionFixture.auth()}),/Unexpected auth failure/);
});

test('sign-in destinations reject external URLs and browser-normalized backslashes',()=>{
 for(const destination of ['https://evil.example','//evil.example','/\\evil.example','/jobs\\evil','/jobs\n']){
  assert.equal(signInPath(destination),'/signin?returnTo=%2Ftracker');
 }
 assert.equal(signInPath('/jobs?job=abc'),'/signin?returnTo=%2Fjobs%3Fjob%3Dabc');
});

test('auth outages leave public layout usable while private access fails closed',async()=>{
 process.env.AUTH_SECRET='session-fixture-secret';
 const locals={auth:async()=>{throw Error('Auth unavailable')}};
 assert.deepEqual(await loadLayout({locals}),{user:null});
 await assert.rejects(requireUser(locals,'/tracker'),/Auth unavailable/);
});
