import {test} from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
register('./helpers/route-loader.mjs',import.meta.url);
const {emailAvailable}=await import('../apps/web/lib/email-digests.ts');
test('Gmail availability requires a valid dedicated sender and app password without requiring Resend configuration',()=>{
  const keys=['EMAIL_PROVIDER','GMAIL_USER','GMAIL_APP_PASSWORD','APP_URL','RESEND_API_KEY','EMAIL_FROM','RESEND_WEBHOOK_SECRET'];
  const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  try{
    for(const key of keys)delete process.env[key];
    Object.assign(process.env,{EMAIL_PROVIDER:'gmail',GMAIL_USER:'frontlanejobs@gmail.com',APP_URL:'https://example.com'});
    assert.equal(emailAvailable(),false);
    process.env.GMAIL_APP_PASSWORD='abcd efgh ijkl mnop';assert.equal(emailAvailable(),true);
    process.env.APP_URL='http://localhost:3000';assert.equal(emailAvailable(),false);
    process.env.APP_URL='https://example.com';process.env.GMAIL_USER='not-email';assert.equal(emailAvailable(),false);
    process.env.EMAIL_PROVIDER='unknown';assert.equal(emailAvailable(),false);
  }finally{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]}}
});
