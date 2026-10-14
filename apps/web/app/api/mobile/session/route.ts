import {database} from '@frontlanejobs/database/client';
import {bearerToken,createMobileSession,loadMobileSession,revokeMobileSession,verifyGoogleToken,MobileAuthError} from '@frontlanejobs/core/mobile-sessions';
import {boundedJson} from '@/lib/auth-api';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
const failed=(error:unknown)=>Response.json({error:error instanceof MobileAuthError?error.message:'Could not complete mobile sign-in. Please try again.'},{status:error instanceof MobileAuthError?error.status:503,headers});

export async function POST(request:Request){
  try{
    const input=await boundedJson(request,16000);
    if(!input||typeof input.idToken!=='string'||Object.keys(input).some(key=>key!=='idToken'))throw new MobileAuthError('Invalid sign-in request',400);
    const user=await verifyGoogleToken(input.idToken,process.env.MOBILE_GOOGLE_AUDIENCE||process.env.AUTH_GOOGLE_ID||'');
    return Response.json(await createMobileSession(database(),user),{status:201,headers});
  }catch(error){
    if(error instanceof SyntaxError||error instanceof Error&&['Payload too large','Empty payload'].includes(error.message))return Response.json({error:'Invalid sign-in request'},{status:400,headers});
    return failed(error);
  }
}
export async function GET(request:Request){
  try{
    const token=bearerToken(request);
    if(!token)throw new MobileAuthError();
    const session=await loadMobileSession(database(),token);
    if(!session)throw new MobileAuthError();
    return Response.json(session,{headers});
  }catch(error){return failed(error)}
}
export async function DELETE(request:Request){
  try{
    const token=bearerToken(request);
    if(!token)throw new MobileAuthError();
    await revokeMobileSession(database(),token);
    return Response.json({ok:true},{headers});
  }catch(error){return failed(error)}
}
