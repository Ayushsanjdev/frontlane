import {database} from '@frontlane/database/client';
import {loadProfile,ProfileInput} from '@frontlane/core/profile';
import {identity,failure,boundedJson} from '@/lib/auth-api';

export async function GET(request:Request){
  try{
    const userId=await identity(request);
    return Response.json(await loadProfile(database(),userId),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error)}
}

export async function POST(request:Request){
  try{
    const userId=await identity(request,true);
    const profile=ProfileInput.parse(await boundedJson(request));
    await database().query('INSERT INTO profiles(user_id,payload) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload',[userId,profile]);
    return Response.json(profile,{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error)}
}
