import {database} from '@frontlanejobs/database/client';
import {identity,failure,boundedJson} from '@/lib/auth-api';
import {z} from 'zod';
const input=z.object({kind:z.enum(['job','company']),target:z.string().min(1).max(200)}).strict();
export async function POST(request:Request){try{const userId=await identity(request,true),value=input.parse(await boundedJson(request,2000));await database().query('INSERT INTO job_feedback(user_id,kind,target) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[userId,value.kind,value.kind==='company'?value.target.toLowerCase():value.target]);return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}})}catch(error){return failure(error)}}
export async function DELETE(request:Request){try{const userId=await identity(request,true);await database().query('DELETE FROM job_feedback WHERE user_id=$1',[userId]);return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}})}catch(error){return failure(error)}}
