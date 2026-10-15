import {hasMatchingPreferences,rankRecommendations} from './recommendations.mjs';
export function dailyNotificationWindow(now=new Date()){
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',hourCycle:'h23'}).format(now));
  return hour>=8?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now):null;
}
export async function dailyCutoff(client,day){
  await client.query('INSERT INTO daily_notification_campaigns(publication_day,cutoff) SELECT $1,COALESCE(max(sequence),0) FROM job_first_publications ON CONFLICT DO NOTHING',[day]);
  return (await client.query('SELECT cutoff FROM daily_notification_campaigns WHERE publication_day=$1',[day])).rows[0].cutoff;
}
export async function notificationJobs(client,{userId,boundary,cutoff,mode}){
  const rows=(await client.query("SELECT j.payload FROM job_first_publications p JOIN LATERAL (SELECT payload FROM jobs WHERE canonical_url=p.canonical_url AND active=true ORDER BY (source='community'),discovered_at DESC LIMIT 1) j ON true WHERE p.sequence>$1 AND p.sequence<=$2 AND p.baseline=false ORDER BY p.sequence",[boundary,cutoff])).rows;
  const feedback=(await client.query('SELECT kind,target FROM job_feedback WHERE user_id=$1',[userId])).rows;
  const jobs=rows.map(r=>r.payload).filter(job=>!feedback.some(row=>row.kind==='job'&&row.target===job.id||row.kind==='company'&&row.target===job.company.toLowerCase()));
  if(mode!=='matching')return jobs;
  const profile=(await client.query('SELECT payload FROM profiles WHERE user_id=$1',[userId])).rows[0]?.payload;
  return hasMatchingPreferences(profile?.matchingPreferences)?rankRecommendations(jobs,profile.matchingPreferences,feedback).filter(job=>job.matchReasons.length>0):[];
}
