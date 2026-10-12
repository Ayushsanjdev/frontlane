import {jobCollection,jobDetail} from '@/lib/jobs';
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
