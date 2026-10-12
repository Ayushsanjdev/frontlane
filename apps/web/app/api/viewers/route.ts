import {randomUUID} from 'node:crypto';
import {database} from '@frontlanejobs/database/client';
import {recordViewer} from '@frontlanejobs/core/viewers';

export const runtime='nodejs';
const cookieName='frontlane_viewer';

export async function POST(request:Request){
  const expected=new URL(process.env.APP_URL||request.url);
  if(request.headers.get('origin')!==expected.origin){
    return Response.json({error:'Forbidden'},{status:403,headers:{'Cache-Control':'no-store'}});
  }
  const existing=request.headers.get('cookie')?.split(';').map(part=>part.trim()).find(part=>part.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  const id=existing&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)?existing:randomUUID();
  try{
    const counts=await recordViewer(database(),id);
    return Response.json(counts,{headers:{
      'Cache-Control':'no-store',
      'Set-Cookie':`${cookieName}=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${expected.protocol==='https:'?'; Secure':''}`
    }});
  }catch{
    return Response.json({error:'Viewer counts unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
