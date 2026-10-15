import {database} from '@frontlanejobs/database/client';
import {disablePushSubscription,sendWebPush} from '@frontlanejobs/core/push-notifications';
export const pushCookie='frontlane-push-device';
export function deviceId(request:Request){const value=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(pushCookie+'='))?.slice(pushCookie.length+1);return value&&/^[0-9a-f-]{36}$/i.test(value)?value:null}
export function pushAvailable(){
  try{return new URL(process.env.NOTIFICATION_APP_URL||process.env.APP_URL||'').protocol==='https:'&&/^[A-Za-z0-9_-]{87}$/.test(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||'')&&/^[A-Za-z0-9_-]{43}$/.test(process.env.VAPID_PRIVATE_KEY||'')&&/^(mailto:|https:\/\/)/.test(process.env.VAPID_SUBJECT||'')}catch{return false}
}
export function sendPush(subscription:unknown,payload:unknown,{signal}:{signal?:AbortSignal}={}){return sendWebPush(subscription,payload,{signal,subject:process.env.VAPID_SUBJECT!,publicKey:process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,privateKey:process.env.VAPID_PRIVATE_KEY!})}
export async function disconnectPushDevice(userId:string){const {cookies}=await import('next/headers');const jar=await cookies(),id=jar.get(pushCookie)?.value;if(id&&/^[0-9a-f-]{36}$/i.test(id))await disablePushSubscription(database(),userId,id);jar.delete(pushCookie)}
