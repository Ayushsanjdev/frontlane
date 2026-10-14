import {database} from '@frontlanejobs/database/client';
import {unsubscribeDigest} from '@frontlanejobs/core/email-digests';
export async function POST(request:Request){
  const token=new URL(request.url).searchParams.get('token')||'';
  try{await unsubscribeDigest(database(),token);return Response.json({message:'If this subscription was active, it has been disabled.'},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({error:'Unsubscribe could not be completed. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
