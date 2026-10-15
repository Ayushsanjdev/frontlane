// Amazon's public careers search. A malformed or truncated response must preserve the last snapshot.
export async function amazonJobs(slug,fetchJson,{signal}={}){
  if(slug!=='amazon')throw Error('Unknown Amazon employer');
  const jobs=new Map();
  for(const query of ['front end','frontend','UI engineer']){
    let offset=0;
    for(let page=0;page<10;page++){
      signal?.throwIfAborted();
      const params=new URLSearchParams({base_query:query,loc_query:'India',country:'IND',offset:String(offset),result_limit:'100'});
      const data=await fetchJson('https://www.amazon.jobs/en/search.json?'+params,signal);
      if(data.error||!Array.isArray(data.jobs)||!Number.isInteger(data.hits)||data.hits<0||!data.jobs.length&&offset<data.hits)throw Error('Invalid Amazon search response');
      for(const row of data.jobs){
        if(typeof row.country_code!=='string'||typeof row.title!=='string'||!row.job_path||!row.id_icims&&!row.id)throw Error('Invalid Amazon job');
        if(row.country_code!=='IND')continue;
        const url=new URL(row.job_path,'https://www.amazon.jobs');
        if(url.origin!=='https://www.amazon.jobs'||!/^\/en\/jobs\/[0-9]+\//.test(url.pathname))throw Error('Unexpected Amazon job URL');
        let arrangement;
        if(Array.isArray(row.locations))for(const item of row.locations){let value;try{value=typeof item==='string'?JSON.parse(item):item}catch{throw Error('Invalid Amazon location')}
          if(['IN','IND'].includes(value.normalizedCountryCode||value.countryIso2a||value.countryIso3a)){arrangement=value.type;break}}
        const date=row.posted_date?Date.parse(/^\d{4}-/.test(row.posted_date)?row.posted_date:row.posted_date+' UTC'):NaN;
        if(row.posted_date&&Number.isNaN(date))throw Error('Invalid Amazon posting date');
        const id=String(row.id_icims||row.id);
        jobs.set(id,{id,title:row.title,location:{name:[row.city,row.state,'India'].filter(Boolean).join(', ')},descriptionPlain:[row.description,row.basic_qualifications,row.preferred_qualifications].filter(Boolean).join(' '),hostedUrl:url.toString(),posted:Number.isNaN(date)?null:new Date(date).toISOString(),
          workplaceType:arrangement==='REMOTE'?'remote':arrangement==='HYBRID'?'hybrid':'on-site',categories:{commitment:row.job_schedule_type},careerStage:row.is_intern===true?'Internship':undefined});
      }
      offset+=data.jobs.length;
      if(offset>=data.hits)break;
      if(page===9)throw Error('Amazon search exceeded refresh budget');
    }
  }
  return [...jobs.values()];
}
