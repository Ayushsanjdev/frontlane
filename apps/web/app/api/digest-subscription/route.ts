import {database} from '@frontlanejobs/database/client';
import {setDigestSubscription} from '@frontlanejobs/core/email-digests';
import {WorkspaceError} from '@frontlanejobs/core/tracker-store';
import {getUser} from '@/lib/session';
import {identity,failure,boundedJson} from '@/lib/auth-api';
import {emailAvailable} from '@/lib/email-digests';
import {z} from 'zod';
async function webMember(request:Request,write=false){if(request.headers.has('authorization'))throw Error('Sign in required');await identity(request,write);const user=await getUser();if(!user?.email)throw Error('Sign in required');return user}
export async function GET(request:Request){try{const user=await webMember(request),row=(await database().query('SELECT enabled,mode,suppressed,email FROM digest_subscriptions WHERE user_id=$1',[user.userId])).rows[0];return Response.json({enabled:row?.email===user.email?!!row?.enabled:false,mode:row?.mode||'matching',suppressed:!!row?.suppressed,email:user.email,available:emailAvailable()},{headers:{'Cache-Control':'no-store'}})}catch(error){return failure(error)}}
export async function POST(request:Request){try{const user=await webMember(request,true),value=z.object({enabled:z.boolean(),mode:z.enum(['matching','all'])}).strict().parse(await boundedJson(request,2000));if(value.enabled&&!emailAvailable())return Response.json({error:'Email delivery is not available yet.'},{status:503,headers:{'Cache-Control':'no-store'}});const result=await setDigestSubscription(database(),{...value,userId:user.userId,verifiedEmail:user.email!});return Response.json(result,{headers:{'Cache-Control':'no-store'}})}catch(error){if(error instanceof WorkspaceError)return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});return failure(error)}}
