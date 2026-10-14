import {database} from '@frontlanejobs/database/client';
import {saveSearch} from '@frontlanejobs/core/job-alerts';
import {WorkspaceError} from '@frontlanejobs/core/tracker-store';
import {identity,failure,boundedJson} from '@/lib/auth-api';
import {z} from 'zod';
export async function GET(request:Request){try{const userId=await identity(request);return Response.json((await database().query('SELECT * FROM saved_searches WHERE user_id=$1 ORDER BY created_at DESC',[userId])).rows,{headers:{'Cache-Control':'no-store'}})}catch(error){return failure(error)}}
export async function POST(request:Request){try{const userId=await identity(request,true);return Response.json(await saveSearch(database(),userId,await boundedJson(request,5000)),{status:201,headers:{'Cache-Control':'no-store'}})}catch(error){if(error instanceof WorkspaceError)return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});return failure(error)}}
export async function DELETE(request:Request){try{const userId=await identity(request,true),{id}=z.object({id:z.string().uuid()}).strict().parse(await boundedJson(request,1000));await database().query('DELETE FROM saved_searches WHERE id=$1 AND user_id=$2',[id,userId]);return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}})}catch(error){return failure(error)}}
