import {matchesJobSearch} from '@frontlanejobs/core/jobs';
import {database} from '@frontlanejobs/database/client';
import {loadProfile} from '@frontlanejobs/core/profile';
import {rankRecommendations,hasMatchingPreferences} from '@frontlanejobs/core/recommendations';
import {identity,failure} from '@/lib/auth-api';
export async function GET(request:Request){
  try{
    const userId=await identity(request),db=database(),profile=await loadProfile(db,userId);
    if(!hasMatchingPreferences(profile.matchingPreferences))return Response.json({jobs:[],total:0,needsPreferences:true},{headers:{'Cache-Control':'no-store'}});
    const [rows,feedback]=await Promise.all([db.query("SELECT payload FROM jobs WHERE active=true AND NOT (source='community' AND EXISTS(SELECT 1 FROM jobs employer WHERE employer.active=true AND employer.source<>'community' AND employer.canonical_url=jobs.canonical_url)) ORDER BY discovered_at DESC LIMIT 2000"),db.query('SELECT kind,target FROM job_feedback WHERE user_id=$1',[userId])]);
    const params=new URL(request.url).searchParams;
    const jobs=rankRecommendations(rows.rows.map((row:{payload:unknown})=>row.payload).filter((job:unknown)=>matchesJobSearch(job,params)),profile.matchingPreferences,feedback.rows);
    const page=Math.max(1,Math.min(200,Number(params.get('page'))||1));
    return Response.json({jobs:jobs.slice((page-1)*12,page*12),total:jobs.length,page,limit:12},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return failure(error)}
}
