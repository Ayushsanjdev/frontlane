import type {PoolClient} from 'pg';
import {Webhook} from 'svix';
import {database} from '@frontlanejobs/database/client';
import {discoveryTransaction} from '@frontlanejobs/core/discovery-store';
import {z} from 'zod';
export const runtime='nodejs';
export async function POST(request:Request){
  const headers={'svix-id':request.headers.get('svix-id')||'','svix-timestamp':request.headers.get('svix-timestamp')||'','svix-signature':request.headers.get('svix-signature')||''};
  if(!process.env.RESEND_WEBHOOK_SECRET)return Response.json({error:'Webhook unavailable'},{status:503});
  let event:{type:string;data:{email_id:string}};
  try{
    if(Number(request.headers.get('content-length'))>100000)throw Error();const reader=request.body?.getReader();if(!reader)throw Error();let size=0;const chunks:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>100000){await reader.cancel();throw Error()}chunks.push(value)}
    const raw=Buffer.concat(chunks);new Webhook(process.env.RESEND_WEBHOOK_SECRET).verify(raw,headers);
    event=z.object({type:z.string().max(100),data:z.object({email_id:z.string().max(200)})}).parse(JSON.parse(raw.toString('utf8')));
  }catch{return Response.json({error:'Invalid webhook'},{status:400})}
  try{
    await discoveryTransaction(database(),async (client:PoolClient)=>{
      const receipt=await client.query('INSERT INTO email_webhook_receipts(id) VALUES($1) ON CONFLICT DO NOTHING RETURNING id',[headers['svix-id']]);if(!receipt.rows.length)return;
      const row=(await client.query('SELECT user_id,recipient FROM email_deliveries WHERE provider_id=$1 FOR UPDATE',[event.data.email_id])).rows[0];if(!row)throw Error('Provider receipt not yet associated with a delivery');
      if(['email.bounced','email.complained'].includes(event.type)){
        await client.query("UPDATE email_deliveries SET status='failed',last_error='Provider reported bounce or complaint' WHERE provider_id=$1",[event.data.email_id]);
        await client.query('UPDATE digest_subscriptions SET suppressed=true,enabled=false WHERE user_id=$1 AND email=$2',[row.user_id,row.recipient]);
        await client.query("UPDATE email_deliveries SET status='suppressed' WHERE user_id=$1 AND recipient=$2 AND status IN ('pending','retry')",[row.user_id,row.recipient]);
      }else if(event.type==='email.delivered')await client.query("UPDATE email_deliveries SET status='delivered' WHERE provider_id=$1 AND status='accepted'",[event.data.email_id]);
    });
    return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Webhook processing unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
