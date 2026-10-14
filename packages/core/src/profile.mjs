import {MatchingPreferencesInput} from './workspace-model.mjs';
import {z} from 'zod';

const field=z.string().max(1000);
const link=field.refine(value=>{
  if(!value)return true;
  try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password}catch{return false}
},'Use an HTTP or HTTPS link');
export const ProfileInput=z.object({
  matchingPreferences:MatchingPreferencesInput.optional(),name:field,location:field,skills:field,experience:field,salary:field,
  availability:field,portfolio:link,resumeUrl:link,preference:field,
}).partial().strict();

export async function loadProfile(db,userId){
  const result=await db.query('SELECT payload FROM profiles WHERE user_id=$1',[userId]);
  return ProfileInput.parse(result.rows[0]?.payload||{});
}
