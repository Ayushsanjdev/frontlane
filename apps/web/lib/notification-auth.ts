import {identity,failure} from '@/lib/auth-api';
import {getUser} from '@/lib/session';
import {WorkspaceError} from '@frontlanejobs/core/tracker-store';
export async function notificationMember(request:Request,write=false){if(request.headers.has('authorization'))throw Error('Sign in required');await identity(request,write);const user=await getUser();if(!user?.email)throw Error('Sign in required');return user}
export function notificationFailure(error:unknown){return error instanceof WorkspaceError?Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}}):failure(error)}
