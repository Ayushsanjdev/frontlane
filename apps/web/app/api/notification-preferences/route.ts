import {database} from '@frontlanejobs/database/client';
import {hasMatchingPreferences} from '@frontlanejobs/core/recommendations';
import {reviewNotificationConsent} from '@frontlanejobs/core/push-notifications';
import {notificationMember,notificationFailure} from '@/lib/notification-auth';
import {emailAvailable} from '@/lib/email-digests';
import {pushAvailable,deviceId} from '@/lib/push-notifications';
import {boundedJson} from '@/lib/auth-api';
import {z} from 'zod';
export async function GET(request:Request){try{
  const user=await notificationMember(request),db=database();
  const consent=(await db.query('SELECT version FROM notification_consents WHERE user_id=$1',[user.userId])).rows[0];
  const profile=(await db.query('SELECT payload FROM profiles WHERE user_id=$1',[user.userId])).rows[0]?.payload;
  const email=(await db.query('SELECT enabled,mode,email,suppressed FROM digest_subscriptions WHERE user_id=$1',[user.userId])).rows[0];
  const push=(await db.query('SELECT enabled,mode FROM push_subscriptions WHERE id=$1 AND user_id=$2',[deviceId(request),user.userId])).rows[0];
  return Response.json({reviewed:consent?.version===1,hasPreferences:!!hasMatchingPreferences(profile?.matchingPreferences),preferences:profile?.matchingPreferences||null,email:{available:emailAvailable(),enabled:!!email?.enabled&&email.email===user.email&&!email.suppressed,mode:email?.mode||'matching'},push:{available:pushAvailable(),enabled:!!push?.enabled,mode:push?.mode||'matching',publicKey:pushAvailable()?process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY:null}},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return notificationFailure(error)}}
export async function POST(request:Request){try{const user=await notificationMember(request,true);z.object({reviewed:z.literal(true)}).strict().parse(await boundedJson(request,200));await reviewNotificationConsent(database(),user.userId);return Response.json({reviewed:true},{headers:{'Cache-Control':'no-store'}})}catch(error){return notificationFailure(error)}}
