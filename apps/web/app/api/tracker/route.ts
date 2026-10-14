import {patchApplication,listApplications,applicationHistory,WorkspaceError} from '@frontlanejobs/core/tracker-store';
import {randomUUID} from 'node:crypto';
import {database} from '@frontlanejobs/database/client';
import {parseApplication,parseRemoval,parseSave} from '@frontlanejobs/core/tracker';
import {identity,failure,boundedJson} from '@/lib/auth-api';

export async function GET(request:Request){
  try{
    const userId=await identity(request);
    const params=new URL(request.url).searchParams;
    if(params.get('history'))return Response.json(await applicationHistory(database(),userId,params.get('history')!),{headers:{'Cache-Control':'no-store'}});
    if(params.get('paginated')==='1')return Response.json(await listApplications(database(),userId,{cursor:params.get('cursor')||'',limit:Number(params.get('limit'))||50,archived:params.get('archived')||'all'}),{headers:{'Cache-Control':'no-store'}});
    const result=await database().query('SELECT payload FROM applications WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1000',[userId]);
    return Response.json(result.rows.map((row:{payload:unknown})=>row.payload),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error)}
}

export async function POST(request:Request){
  try{
    const userId=await identity(request,true);
    const body=await boundedJson(request);
    const saving=body?.action!==undefined;
    const input=saving?parseSave(body):parseApplication(body);
    const item={...input,id:randomUUID(),updatedAt:new Date().toISOString()};
    const result=await database().query(
      saving?"INSERT INTO applications(id,user_id,job_id,payload) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,job_id) DO UPDATE SET payload=applications.payload RETURNING payload":
      "INSERT INTO applications(id,user_id,job_id,payload) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,job_id) DO UPDATE SET payload=jsonb_set(applications.payload || excluded.payload,'{id}',to_jsonb(applications.id::text)),updated_at=now() RETURNING payload",
      [item.id,userId,item.jobId,item]
    );
    return Response.json(result.rows[0].payload,{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error)}
}

export async function DELETE(request:Request){
  try{
    const userId=await identity(request,true);
    const {id}=parseRemoval(await boundedJson(request,2000));
    await database().query('DELETE FROM applications WHERE id=$1 AND user_id=$2',[id,userId]);
    return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error)}
}

export async function PATCH(request:Request){
  try{const userId=await identity(request,true);return Response.json(await patchApplication(database(),userId,await boundedJson(request,100000)),{headers:{'Cache-Control':'no-store'}})}
  catch(error){if(error instanceof WorkspaceError)return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});return failure(error)}
}
