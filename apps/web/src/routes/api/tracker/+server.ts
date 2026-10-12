import type {RequestEvent} from '@sveltejs/kit';
import {randomUUID} from 'node:crypto';
import {database} from '@frontlanejobs/database/client';
import {parseApplication,parseRemoval} from '@frontlanejobs/core/tracker';
import {identity,failure,boundedJson} from '$lib/server/auth-api';

export async function GET({request,locals}:RequestEvent){
  try{
    const userId=await identity({request,locals});
    const result=await database().query('SELECT payload FROM applications WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 1000',[userId]);
    return Response.json(result.rows.map((row:{payload:unknown})=>row.payload),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error)}
}

export async function POST({request,locals}:RequestEvent){
  try{
    const userId=await identity({request,locals},true);
    const input=parseApplication(await boundedJson(request));
    const item={...input,id:randomUUID(),updatedAt:new Date().toISOString()};
    const result=await database().query(
      "INSERT INTO applications(id,user_id,job_id,payload) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,job_id) DO UPDATE SET payload=jsonb_set(excluded.payload,'{id}',to_jsonb(applications.id::text)),updated_at=now() RETURNING payload",
      [item.id,userId,item.jobId,item]
    );
    return Response.json(result.rows[0].payload,{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error)}
}

export async function DELETE({request,locals}:RequestEvent){
  try{
    const userId=await identity({request,locals},true);
    const {id}=parseRemoval(await boundedJson(request,2000));
    await database().query('DELETE FROM applications WHERE id=$1 AND user_id=$2',[id,userId]);
    return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error)}
}
