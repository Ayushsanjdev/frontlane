import {bearerToken,loadMobileSession} from '@frontlanejobs/core/mobile-sessions';
import {database} from '@frontlanejobs/database/client';
import {ZodError} from 'zod';
import {getUser} from './session';
export async function identity(request:Request,write=false){
  if(request.headers.has('authorization')){
    const token=bearerToken(request);
    if(!token)throw Error('Sign in required');
    let session;
    try{session=await loadMobileSession(database(),token)}catch{throw Error('Session unavailable')}
    if(!session)throw Error('Sign in required');
    return session.user.userId;
  }
  if(write){const origin=request.headers.get('origin');const expected=new URL(process.env.APP_URL||request.url).origin;if(!origin||origin!==expected)throw Error('Forbidden')}
  const u=await getUser();if(!u)throw Error('Sign in required');return u.userId;
}
export function failure(e:unknown){if(e instanceof ZodError)return Response.json({error:e.issues[0]?.message||'Invalid input'},{status:400,headers:{'Cache-Control':'no-store'}});const m=e instanceof Error?e.message:'';return Response.json({error:m==='Forbidden'||m==='Sign in required'?m:'Request could not be completed.'},{status:m==='Sign in required'?401:m==='Forbidden'?403:m==='Session unavailable'?503:400,headers:{'Cache-Control':'no-store'}})}
export async function boundedJson(r:Request,max=30000){if(Number(r.headers.get('content-length'))>max)throw Error('Payload too large');const reader=r.body?.getReader();if(!reader)throw Error('Empty payload');let size=0;const chunks:Uint8Array[]=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Payload too large')}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}return JSON.parse(new TextDecoder().decode(bytes))}
