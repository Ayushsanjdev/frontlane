// Public employer postings: https://developers.smartrecruiters.com/docs/endpoints
export async function smartRecruitersJobs(slug,fetchJson,eligible,target,{signal:callerSignal}={}){
  const base=`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings`;
  const timeout=AbortSignal.timeout(45000);
  const signal=callerSignal?AbortSignal.any([callerSignal,timeout]):timeout;
  const candidates=[];
  const seen=new Set();
  let offset=0;
  for(let page=0;page<10;page++){
    const data=await fetchJson(`${base}?country=in&limit=100&offset=${offset}`,signal);
    if(!Array.isArray(data.content)||!Number.isInteger(data.totalFound)||data.totalFound<0)throw Error('Invalid employer pagination');
    if(!data.content.length&&offset<data.totalFound)throw Error('Incomplete employer pagination');
    for(const row of data.content){
      if(!row||typeof row.name!=='string'||!row.location||!row.id)throw Error('Invalid employer posting');
      if(row.location.country!=='in'||!eligible(row.name,row.location.fullLocation||'India','')||seen.has(row.id))continue;
      seen.add(row.id);
      candidates.push(row);

    }
    offset+=data.content.length;
    if(offset>=data.totalFound)break;
    if(page===9)throw Error('Employer pagination exceeded refresh budget');
  }
  const jobs=[];
  for(let start=0;start<candidates.length;start+=4){
    const details=await Promise.all(candidates.slice(start,start+4).map(row=>fetchJson(`${base}/${encodeURIComponent(row.id)}`,signal)));
    for(const row of details){
      if(row.active===false)continue;
      if(!row.location||row.location.country!=='in'||typeof row.name!=='string'||!row.jobAd?.sections)throw Error('Invalid employer job detail');
      jobs.push({
        id:row.id,title:row.name,location:{name:row.location.fullLocation||'India'},
        workplaceType:row.location.remote?'remote':row.location.hybrid?'hybrid':'on-site',
        categories:{commitment:row.typeOfEmployment?.label},
        descriptionPlain:Object.values(row.jobAd.sections).map(section=>section.text||'').join(' '),
        hostedUrl:row.postingUrl,posted:row.releasedDate||null,company:row.company,
      });
    }
  }
  return jobs;
}
