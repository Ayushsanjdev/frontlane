import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/session-loader.mjs',import.meta.url);
const {getUser,requireUser}=await import('../apps/web/lib/session.ts');
const previous={AUTH_SECRET:process.env.AUTH_SECRET,NEXTAUTH_SECRET:process.env.NEXTAUTH_SECRET};
after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value}});

test('unconfigured auth permits anonymous pages and redirects private pages without calling Auth.js',async()=>{
  delete process.env.NEXTAUTH_SECRET;
  process.env.AUTH_SECRET='';
  globalThis.__sessionFixture={auth:async()=>{assert.fail('Auth.js must not run without a secret')}};
  assert.equal(await getUser(),null);
  await assert.rejects(requireUser('/tracker'),/Redirect: \/signin\?returnTo=%2Ftracker/);
});
test('configured auth preserves the authenticated identity and propagates unexpected failures',async()=>{
  process.env.AUTH_SECRET='session-fixture-secret';
  globalThis.__sessionFixture={auth:async()=>({user:{id:'google:123',name:'Alice',email:'alice@example.com'}})};
  assert.deepEqual(await getUser(),{userId:'google:123',displayName:'Alice',fullName:'Alice',email:'alice@example.com'});
  globalThis.__sessionFixture.auth=async()=>{throw Error('Unexpected auth failure')};
  await assert.rejects(getUser(),/Unexpected auth failure/);
});
