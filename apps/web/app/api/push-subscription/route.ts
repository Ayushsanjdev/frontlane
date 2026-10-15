import {database} from '@frontlanejobs/database/client';
import {setPushSubscription,disablePushSubscription} from '@frontlanejobs/core/push-notifications';
import {notificationMember,notificationFailure} from '@/lib/notification-auth';
import {pushAvailable,pushCookie,deviceId} from '@/lib/push-notifications';
import {boundedJson} from '@/lib/auth-api';
import {z} from 'zod';
export async function POST(request:Request){try{
  const user=await notificationMember(request,true);if(!pushAvailable())return Response.json({error:'Browser push is being configured.'},{status:503});
  const value=z.object({subscription:z.unknown(),mode:z.enum(['matching','all'])}).strict().parse(await boundedJson(request,5000));
  const result=await setPushSubscription(database(),user.userId,value);
  return Response.json(result,{headers:{'Cache-Control':'no-store','Set-Cookie':pushCookie+'='+result.id+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000'+(new URL(request.url).protocol==='https:'?'; Secure':'')}});
  }catch(error){return notificationFailure(error)}}
export async function DELETE(request:Request){try{const user=await notificationMember(request,true),id=deviceId(request);if(id)await disablePushSubscription(database(),user.userId,id);return Response.json({enabled:false},{headers:{'Cache-Control':'no-store','Set-Cookie':pushCookie+'=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'}})}catch(error){return notificationFailure(error)}}
