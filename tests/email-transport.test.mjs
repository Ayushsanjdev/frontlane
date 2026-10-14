import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resendTransport} from '../packages/core/src/email-transport.mjs';
test('provider requests preserve idempotency and rate-limit backoff',async()=>{
  const send=resendTransport('test-key',{fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers['Idempotency-Key'],'one');assert.deepEqual(JSON.parse(options.body),{to:['test@example.com']});
    return new Response('{}',{status:429,headers:{'Retry-After':'30'}});
  }});
  await assert.rejects(send({body:{to:['test@example.com']},idempotencyKey:'one'}),error=>error.permanent===false&&error.retryAfterMs===30000);
});
test('malformed acceptance is not recorded as provider success',async()=>{
  const send=resendTransport('test-key',{fetchImpl:async()=>Response.json({})});
  await assert.rejects(send({body:{},idempotencyKey:'one'}),/Invalid provider response/);
});
