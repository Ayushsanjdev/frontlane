import {jobCollection,jobDetail} from '@/lib/jobs';
import {identity,boundedJson,failure} from '@/lib/auth-api';
import {publishPublicJob,PublicJobError} from '@frontlanejobs/core/public-jobs';
import {database} from '@frontlanejobs/database/client';
import {ZodError} from 'zod';
export const runtime='nodejs';

export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  const id=params.get('id');
  if(id){
    if(id.length>200)return Response.json({error:'Invalid job ID'},{status:400});
    const {job,fallback}=await jobDetail(id);
    return Response.json({job},{status:job?200:404,headers:{'Cache-Control':fallback?'no-store':'public,max-age=30,s-maxage=60'}});
  }
  const result=await jobCollection(params);
  return Response.json(result,{headers:{'Cache-Control':result.warning?'no-store':'public,max-age=30,s-maxage=60'}});
}

export async function POST(request:Request){
  try{
    const userId=await identity(request,true);
    const input=await boundedJson(request,16000);
    const result=await publishPublicJob(database(),userId,input);
    return Response.json(result,{status:result.replayed?200:201,headers:{'Cache-Control':'no-store'}});
  }catch(error){
    if(error instanceof PublicJobError)return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});
    if(error instanceof ZodError||error instanceof SyntaxError||error instanceof Error&&['Forbidden','Sign in required','Payload too large','Empty payload'].includes(error.message))return failure(error);
    return Response.json({error:'Could not publish the job. Please try again.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
