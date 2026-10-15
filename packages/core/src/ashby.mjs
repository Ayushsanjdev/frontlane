// Official public job-board API: https://developers.ashbyhq.com/docs/public-job-posting-api
export async function ashbyJobs(slug,fetchJson){
  const data=await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`);
  if(!Array.isArray(data.jobs)||data.jobs.length>10000)throw Error('Invalid Ashby job board');
  return data.jobs.filter(row=>row.isListed===true).map(row=>{
    if(typeof row.title!=='string'||typeof row.location!=='string'||typeof row.jobUrl!=='string'||typeof row.descriptionPlain!=='string')throw Error('Invalid Ashby job record');
    const url=new URL(row.jobUrl);
    if(url.protocol!=='https:'||url.hostname!=='jobs.ashbyhq.com'||url.pathname.split('/')[1].toLowerCase()!==slug.toLowerCase()||url.username||url.password)throw Error('Unexpected Ashby job URL');
    const locations=[{location:row.location,address:row.address?.postalAddress},...(row.secondaryLocations||[])];
    const eligible=locations.filter(l=>/\bindia\b|bengaluru|bangalore|hyderabad|pune|mumbai|chennai|gurugram|gurgaon|noida|delhi|worldwide|anywhere in the world/i.test(l.location)||/^(in|ind|india)$/i.test(l.address?.addressCountry||''));
    const location=(eligible.length?eligible:locations.slice(0,1)).map(l=>l.location+(/^(in|ind|india)$/i.test(l.address?.addressCountry||'')&&!/\bindia\b/i.test(l.location)?', India':'')).join(' · ');
    return {id:row.id||url.pathname.split('/').filter(Boolean).at(-1),title:row.title,location:{name:location},descriptionPlain:row.descriptionPlain,hostedUrl:row.jobUrl,
      workplaceType:row.workplaceType==='Hybrid'?'hybrid':row.workplaceType==='OnSite'?'on-site':row.workplaceType==='Remote'||row.isRemote?'remote':undefined,
      categories:{commitment:row.employmentType},posted:row.publishedAt||null,careerStage:row.employmentType==='Intern'?'Internship':undefined,compensation:row.compensation};
  });
}
