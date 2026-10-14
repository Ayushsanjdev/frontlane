export function matchJob(job,preferences={}){
  const p=preferences,reasons=[],unknowns=[];
  const mode=job.enrichment?.arrangement||job.mode;
  if(mode==='Unknown')unknowns.push('Work arrangement not confirmed');
  else if(p.arrangements?.length&&!p.arrangements.includes(mode))return {eligible:false,reasons,unknowns,rank:[]};
  if(p.types?.length&&!p.types.includes(job.type))return {eligible:false,reasons,unknowns,rank:[]};
  if(p.cities?.length&&mode!=='Remote'&&!p.cities.some(city=>job.location.toLowerCase().includes(city.toLowerCase())))return {eligible:false,reasons,unknowns,rank:[]};
  const matched=(p.skills||[]).filter(skill=>job.tags.some(tag=>tag.toLowerCase()===skill.toLowerCase()));
  if(matched.length)reasons.push('Matches '+matched.join(' and '));
  if(p.arrangements?.includes(mode))reasons.push(mode+' matches your preference');
  const role=(p.roles||[]).some(role=>job.title.toLowerCase().replace(/[^a-z]/g,'').includes(role.toLowerCase().replace(/[^a-z]/g,'')));
  if(role)reasons.push('Matches your target role');
  const experience=job.enrichment?.yearsMin;
  if(experience===undefined)unknowns.push('Experience requirements not confirmed');
  else if(p.years!==undefined&&p.years>=experience)reasons.push('Your experience meets the listed minimum');
  else if(p.years!==undefined)unknowns.push('Listed experience exceeds your profile');
  const pay=job.enrichment?.compensation;
  if(!pay)unknowns.push('Salary not disclosed');
  if(p.salaryMin!==undefined&&pay&&pay.currency===p.currency&&pay.period===p.payPeriod&&pay.max<p.salaryMin)return {eligible:false,reasons,unknowns,rank:[]};
  return {eligible:true,reasons,unknowns,rank:[matched.length,Number(role),Number(experience!==undefined&&p.years!==undefined&&p.years>=experience),Number(p.arrangements?.includes(mode))]};
}
export function hasMatchingPreferences(p){return !!p&&(p.skills?.length||p.roles?.length||p.cities?.length||p.arrangements?.length||p.types?.length||p.years!==undefined||p.salaryMin!==undefined)}
export function rankRecommendations(jobs,preferences,feedback=[]){
  const hiddenJobs=new Set(feedback.filter(row=>row.kind==='job').map(row=>row.target)),hiddenCompanies=new Set(feedback.filter(row=>row.kind==='company').map(row=>row.target.toLowerCase()));
  const items=jobs.filter(job=>!hiddenJobs.has(job.id)&&!hiddenCompanies.has(job.company.toLowerCase())).map(job=>({job,match:matchJob(job,preferences)})).filter(item=>item.match.eligible);
  items.sort((a,b)=>{for(let i=0;i<a.match.rank.length;i++){const difference=b.match.rank[i]-a.match.rank[i];if(difference)return difference}return b.job.discovered.localeCompare(a.job.discovered)||a.job.id.localeCompare(b.job.id)});
  const result=[];
  for(let index=0;index<items.length;){
    const rank=JSON.stringify(items[index].match.rank),groups=new Map();
    while(index<items.length&&JSON.stringify(items[index].match.rank)===rank){const item=items[index++],key=item.job.company.toLowerCase();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item)}
    while([...groups.values()].some(group=>group.length))for(const group of groups.values())if(group.length){const item=group.shift();result.push({...item.job,matchReasons:item.match.reasons,matchUnknowns:item.match.unknowns})}
  }
  return result;
}
