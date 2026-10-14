export class EmailTransportError extends Error {
  constructor(message,{permanent=false,suppressRecipient=false,retryAfterMs=0}={}){super(message);this.permanent=permanent;this.suppressRecipient=suppressRecipient;this.retryAfterMs=retryAfterMs}
}
export function resendTransport(apiKey,{fetchImpl=fetch}={}){
  return async function send({body,idempotencyKey,signal}){
    if(!apiKey)throw new EmailTransportError('Email delivery is unavailable');
    const timeout=AbortSignal.timeout(10000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
    const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify(body),signal:combined,redirect:'error'});
    if(!response.ok){const value=response.headers.get('retry-after'),retryAfterMs=value?Math.max(0,Number(value)*1000||Date.parse(value)-Date.now()):0;throw new EmailTransportError('Email provider rejected delivery',{permanent:response.status>=400&&response.status<500&&![408,409,429].includes(response.status),retryAfterMs})}
    const data=await response.json();if(typeof data.id!=='string'||!data.id)throw new EmailTransportError('Invalid provider response');return {providerId:data.id};
  };
}
