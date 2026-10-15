import {createHash} from 'node:crypto';
import nodemailer from 'nodemailer';
export class EmailTransportError extends Error {
  constructor(message,{permanent=false,suppressRecipient=false,retryAfterMs=0,ambiguous=false}={}){super(message);this.permanent=permanent;this.suppressRecipient=suppressRecipient;this.retryAfterMs=retryAfterMs;this.ambiguous=ambiguous}
}
export function gmailTransport(user,appPassword,{createTransport=nodemailer.createTransport}={}){
  return async function send({body,idempotencyKey,signal}){
    const password=appPassword?.replace(/\s/g,'');
    if(!/^[^\s@]+@gmail\.com$/i.test(user||'')||!password||password.length!==16)throw new EmailTransportError('Gmail delivery is not configured',{permanent:true});
    if(signal?.aborted)throw new EmailTransportError('Delivery budget exhausted');
    if(!Array.isArray(body.to)||body.to.length!==1||typeof body.to[0]!=='string')throw new EmailTransportError('Invalid digest recipient',{permanent:true});
    const smtp=createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user,pass:password},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false});
    const messageId='<'+createHash('sha256').update(idempotencyKey).digest('hex')+'@gmail.com>';
    let timer,abort;
    try{
      const stopped=new Promise((_,reject)=>{
        abort=()=>reject(new EmailTransportError('Uncertain Gmail delivery',{ambiguous:true}));
        timer=setTimeout(abort,10000);signal?.addEventListener('abort',abort,{once:true});
      });
      const info=await Promise.race([smtp.sendMail({from:{name:'FrontlaneJobs',address:user},to:body.to,subject:body.subject,html:body.html,text:body.text,headers:body.headers,messageId,disableFileAccess:true,disableUrlAccess:true}),stopped]);
      if(!info.accepted?.some(address=>String(address).toLowerCase()===body.to[0].toLowerCase()))throw new EmailTransportError('Uncertain Gmail delivery',{ambiguous:true});
      return {providerId:messageId};
    }catch(error){
      if(error instanceof EmailTransportError)throw error;
      const explicit=Number(error.responseCode)>=400&&Number(error.responseCode)<600;
      throw new EmailTransportError('Gmail rejected or could not confirm delivery',{permanent:explicit&&error.responseCode>=500,suppressRecipient:explicit&&error.responseCode===550&&error.command==='RCPT TO'&&/\b5\.1\.1\b/.test(error.response||''),ambiguous:!explicit});
    }finally{clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);smtp.close?.()}
  };
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
