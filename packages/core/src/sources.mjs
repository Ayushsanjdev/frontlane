import {randomUUID} from 'node:crypto';
import {decodeHTMLStrict} from 'entities';
import {canonicalUrl,JobInput} from './ingestion.mjs';
import {smartRecruitersJobs} from './smartrecruiters.mjs';

export const DAILY_JOB_TARGET=50;
export const SOURCES=[
  ['greenhouse','cloudsek','CloudSEK'],
  ['greenhouse','pay2dc','PayPay India'],
  ['greenhouse','kraftonindia','KRAFTON India'],
  ['greenhouse','quince','Quince'],
  ['greenhouse','anaplan','Anaplan'],
  ['greenhouse','okta','Okta'],
  ['greenhouse','canonical','Canonical'],
  ['greenhouse','gitlab','GitLab'],
  ['greenhouse','rubrik','Rubrik'],
  ['greenhouse','netskope','Netskope'],
  ['greenhouse','zscaler','Zscaler'],
  ['greenhouse','databricks','Databricks'],
  ['greenhouse','mongodb','MongoDB'],
  ['greenhouse','elastic','Elastic'],
  ['greenhouse','grafanalabs','Grafana Labs'],
  ['greenhouse','twilio','Twilio'],
  ['greenhouse','cloudflare','Cloudflare'],
  ['greenhouse','inmobi','InMobi'],
  ['greenhouse','harnessinc','Harness'],
  ['greenhouse','fivetran','Fivetran'],
  ['greenhouse','diligentcorporation','Diligent'],
  ['greenhouse','toast','Toast'],
  ['greenhouse','sonicwall','SonicWall'],
  ['greenhouse','hyreo','Hyreo'],
  ['greenhouse','sigmoid','Sigmoid'],
  ['greenhouse','openfx','OpenFX'],
  ['lever','greenlight','Greenlight'],
  ['lever','drivetrain','Drivetrain'],
  ['lever','hevodata','Hevo Data'],
  ['lever','acceldata','Acceldata'],
  ['lever','meesho','Meesho'],
  ['lever','mindtickle','Mindtickle'],
  ['lever','gohighlevel','HighLevel'],
  ['lever','lingarogroup','Lingaro'],
  ['smartrecruiters','Nagarro1','Nagarro'],
  ['smartrecruiters','SopraSteria1','Sopra Steria'],
  ['smartrecruiters','BoschGroup','Bosch'],
  ['smartrecruiters','Miratech1','Miratech'],
  ['smartrecruiters','SynergyMachines','Synergy Machines'],
];

export function clean(value){
  let text=String(value||'');
  // ATS feeds can escape the entire HTML document, sometimes more than once.
  // Decode before stripping tags so their names and attributes never become text.
  for(;;){
    const decoded=decodeHTMLStrict(text);
    if(decoded===text)break;
    text=decoded;
  }
  return text.replace(/<!--[\s\S]*?-->|<!doctype\b[^>]*>|<\/?[a-z][^>]*>/gi,' ').replace(/\s+/g,' ').trim();
}

export function eligible(title,location,description){
  return /front[ -]?end|react|angular|vue(?:\.js)?|\bui\b.*(?:engineer|developer)|(?:engineer|developer).*\bui\b|\bweb\s+(?:engineer|developer)/i.test(title)&&
    /india|bengaluru|bangalore|hyderabad|pune|mumbai|chennai|gurugram|gurgaon|noida|delhi|worldwide|anywhere in the world/i.test(location)&&
    !/intern|director|manager/i.test(title)&&
    !/US citizens only|US residents only|must be based in (the )?(US|United States|Canada)|full (US|EST) (business|working)/i.test(description);
}

function employmentType(row){
  const metadata=(row.metadata||[]).filter(item=>/employment|commitment|job type/i.test(item.name||'')).map(item=>item.value).join(' ');
  const text=[row.categories?.commitment,metadata,row.title||row.text].join(' ');
  if(/freelanc/i.test(text))return 'Freelance';
  if(/part[ -]?time/i.test(text))return 'Part-time';
  if(/contract|temporary/i.test(text))return 'Contract';
  return 'Full-time';
}

function normalize(row,provider,company,checked){
  if(!row||typeof row!=='object')throw Error('Invalid job record');
  const title=row.title||row.text;
  const location=row.location?.name||row.categories?.location;
  if(typeof title!=='string'||typeof location!=='string')throw Error('Invalid job title or location');
  const description=clean([row.content||row.descriptionPlain||row.description,(row.lists||[]).map(item=>(item.text||'')+' '+(item.content||'')).join(' ')].join(' '));
  if(!eligible(title,location,description))return null;
  if(row.id===undefined||row.id===null)throw Error('Missing job ID');
  const url=canonicalUrl(provider==='greenhouse'?row.absolute_url:row.hostedUrl);
  return JobInput.parse({
    requisitionId:String(row.id),title:title.slice(0,160),company,location:location.slice(0,200),
    mode:row.workplaceType==='remote'||/remote|home based|worldwide|anywhere in the world/i.test(location)?'Remote':row.workplaceType==='hybrid'||/hybrid/i.test(location)?'Hybrid':'Onsite',
    type:employmentType(row),salary:'Not disclosed',
    tags:['React Native','Next.js','React','TypeScript','Tailwind','Redux','AWS','JavaScript','Angular','Vue','Svelte'].filter(tag=>(title+' '+description).toLowerCase().includes(tag.toLowerCase())),
    experience:'See employer requirements',summary:description.slice(0,1500),
    caveat:'Review the full employer listing, eligibility and working hours before applying.',
    url,checked,posted:provider==='smartrecruiters'?row.posted:provider==='lever'&&row.createdAt?new Date(row.createdAt).toISOString():null,
    eligibility:/worldwide|anywhere/i.test(location)?'Worldwide remote':'India location listed',
    degree:/equivalent (practical|professional|work) experience/i.test(description)?'Equivalent experience accepted':'Review employer requirements',
  });
}

async function fetchJson(endpoint,deadline){
    let response;
    for(let attempt=0;attempt<2;attempt++){
      const timeout=AbortSignal.timeout(12000);
      try{response=await fetch(endpoint,{signal:deadline?AbortSignal.any([deadline,timeout]):timeout})}
      catch(error){if(attempt===1)throw error;continue}
      if(response.ok||response.status!==429&&response.status<500)break;
    }
    if(!response?.ok)throw Error('Employer feed HTTP '+response?.status);
    return response.json();
}

async function fetchFeed([provider,slug,company],checked){
  const source=provider+':'+slug.toLowerCase();
  try{
    let raw;
    if(provider==='smartrecruiters')raw=await smartRecruitersJobs(slug,fetchJson,eligible,DAILY_JOB_TARGET);
    else{
      const endpoint=provider==='greenhouse'?`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`:`https://api.lever.co/v0/postings/${slug}?mode=json`;
      const data=await fetchJson(endpoint);
      raw=provider==='greenhouse'?data.jobs:data;
    }
    if(!Array.isArray(raw))throw Error('Invalid feed');
    // Validate before replacing a snapshot: malformed feeds must preserve existing jobs.
    const jobs=raw.map(row=>normalize(row,provider,company,checked)).filter(Boolean);
    return {source,jobs};
  }catch(error){return {source,status:'failed',error:String(error.message).slice(0,160)}}
}

function selectJobs(feeds){
  const seen=new Set();
  const queues=feeds.filter(feed=>feed.jobs).map(feed=>{
    const groups=new Map();
    for(const job of feed.jobs){
      const key=job.type+':'+job.mode;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(job);
    }
    // Round-robin arrangements within each employer, then employers across the collection.
    const queue=[];
    while([...groups.values()].some(group=>group.length)){
      for(const group of groups.values())if(group.length)queue.push(group.shift());
    }
    return {source:feed.source,queue,selected:[]};
  });
  let count=0;
  while(count<DAILY_JOB_TARGET&&queues.some(item=>item.queue.length)){
    for(const item of queues){
      let job;
      while(item.queue.length&&!job){
        const next=item.queue.shift();
        if(!seen.has(next.url)){seen.add(next.url);job=next}
      }
      if(job){item.selected.push(job);count++}
      if(count===DAILY_JOB_TARGET)break;
    }
  }
  return new Map(queues.map(item=>[item.source,item.selected]));
}

export async function refreshSources(publish,{sources=SOURCES}={}){
  const checked=new Date().toISOString();
  const runId='ats-'+randomUUID();
  const feeds=[];
  // Bound remote requests so the production cron can finish within its time budget.
  for(let i=0;i<sources.length;i+=4){
    feeds.push(...await Promise.all(sources.slice(i,i+4).map(source=>fetchFeed(source,checked))));
  }
  const selected=selectJobs(feeds);
  const outcomes=[];
  for(const feed of feeds){
    if(feed.status==='failed'){outcomes.push(feed);continue}
    const jobs=selected.get(feed.source);
    try{
      // The snapshot is this employer's share of the daily selection, not its entire feed.
      const receipt=await publish({source:feed.source,runId,jobs,completeSnapshot:true});
      outcomes.push({source:feed.source,status:'ok',matched:jobs.length,available:feed.jobs.length,receipt});
    }catch(error){outcomes.push({source:feed.source,status:'failed',error:String(error.message).slice(0,160)})}
  }
  return outcomes;
}

export function refreshSummary(sources){
  const published=sources.filter(source=>source.status==='ok').reduce((sum,source)=>sum+source.matched,0);
  return {target:DAILY_JOB_TARGET,published,shortfall:Math.max(0,DAILY_JOB_TARGET-published),failedSources:sources.filter(source=>source.status==='failed').length};
}
