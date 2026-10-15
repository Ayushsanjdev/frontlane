import {ashbyJobs} from './ashby.mjs';
import {amazonJobs} from './amazon.mjs';
import {classifyRemote} from './remote-eligibility.mjs';
import {enrichJob,technologyTokens} from './job-enrichment.mjs';
import {randomUUID} from 'node:crypto';
import {decodeHTMLStrict} from 'entities';
import {canonicalUrl,JobInput} from './ingestion.mjs';
import {smartRecruitersJobs} from './smartrecruiters.mjs';

export const DAILY_JOB_TARGET=50;
export const SOURCES=[
  ['amazon','amazon','Amazon'],
  ['ashby','plane','Plane'],
  ['ashby','sarvam','Sarvam AI'],
  ['ashby','supabase','Supabase'],
  ['ashby','notion','Notion'],
  ['ashby','linear','Linear'],
  ['ashby','ashby','Ashby'],
  ['ashby','coder','Coder'],
  ['greenhouse','stripe','Stripe'],
  ['greenhouse','figma','Figma'],
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
  ['greenhouse','meltplan','MeltPlan'],
  ['greenhouse','poppulo','Poppulo'],
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
  ['smartrecruiters','Sia','Sia'],
  ['smartrecruiters','NECSWS','NEC Software Solutions'],
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
    /\b(?:india|bengaluru|bangalore|hyderabad|pune|mumbai|chennai|gurugram|gurgaon|noida|delhi|worldwide|anywhere in the world)\b/i.test(location)&&
    !/director|manager/i.test(title)&&
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
  const normalized=JobInput.parse({
    requisitionId:String(row.id),title:title.slice(0,160),company,location:location.slice(0,200),
    mode:row.workplaceType==='remote'||/remote|home based|worldwide|anywhere in the world/i.test(location)?'Remote':row.workplaceType==='hybrid'||/hybrid/i.test(location)?'Hybrid':'Onsite',
    type:employmentType(row),salary:'Not disclosed',
    tags:technologyTokens(title+' '+description),
    enrichment:enrichJob({title,description,arrangement:row.workplaceType==='remote'?'Remote':row.workplaceType==='hybrid'?'Hybrid':/on[- ]?site/i.test(row.workplaceType||'')?'Onsite':/remote|home based|worldwide|anywhere in the world/i.test(location)?'Remote':/hybrid/i.test(location)?'Hybrid':'Unknown'}),
    experience:'See employer requirements',summary:description.slice(0,1500),
    caveat:'Review the full employer listing, eligibility and working hours before applying.',
    url,checked,posted:['smartrecruiters','ashby','amazon'].includes(provider)?row.posted:provider==='lever'&&row.createdAt?new Date(row.createdAt).toISOString():null,
    eligibility:/worldwide|anywhere/i.test(location)?'Worldwide remote':'India location listed',
    degree:/equivalent (practical|professional|work) experience/i.test(description)?'Equivalent experience accepted':'Review employer requirements',
  });
  if(row.careerStage)normalized.enrichment.careerStage=row.careerStage;
  const remote=classifyRemote({location,description,arrangement:normalized.enrichment?.arrangement||normalized.mode,checked});
  if(remote)normalized.remote=remote;
  const pay=normalized.enrichment?.compensation;if(pay)normalized.salary=pay.currency+' '+pay.min.toLocaleString('en-IN')+(pay.max!==pay.min?'–'+pay.max.toLocaleString('en-IN'):'')+' / '+pay.period;
  if(normalized.enrichment?.yearsMin!==undefined)normalized.experience=normalized.enrichment.yearsMin+(normalized.enrichment.yearsMax!==undefined?'–'+normalized.enrichment.yearsMax:'+')+' years';
  return normalized;
}

async function fetchJson(endpoint,deadline,fetchImpl=fetch,retries=true){
    let response;
    for(let attempt=0;attempt<(retries?2:1);attempt++){
      const timeout=AbortSignal.timeout(12000);
      try{deadline?.throwIfAborted();response=await fetchImpl(endpoint,{redirect:'error',signal:deadline?AbortSignal.any([deadline,timeout]):timeout})}
      catch(error){if(!retries||attempt===1||deadline?.aborted)throw error;continue}
      if(response.ok||response.status!==429&&response.status<500)break;
    }
    if(!response?.ok)throw Error('Employer feed HTTP '+response?.status);
    return response.json();
}

export async function fetchEmployerFeed([provider,slug,company],checked,{signal,fetchImpl=fetch,retries=true}={}){
  const source=provider+':'+slug.toLowerCase();
  try{
    let raw;
    const getJson=(url,deadline)=>fetchJson(url,signal&&deadline?AbortSignal.any([signal,deadline]):signal||deadline,fetchImpl,retries);
    if(provider==='ashby')raw=await ashbyJobs(slug,getJson);
    else if(provider==='amazon')raw=await amazonJobs(slug,getJson,{signal});
    else if(provider==='smartrecruiters')raw=await smartRecruitersJobs(slug,getJson,eligible,DAILY_JOB_TARGET,{signal});
    else if(['greenhouse','lever'].includes(provider)){
      const endpoint=provider==='greenhouse'?`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`:`https://api.lever.co/v0/postings/${slug}?mode=json`;
      const data=await getJson(endpoint);
      raw=provider==='greenhouse'?data.jobs:data;
    }
    else throw Error('Unsupported employer provider');
    if(!Array.isArray(raw))throw Error('Invalid feed');
    // Validate before replacing a snapshot: malformed feeds must preserve existing jobs.
    const jobs=raw.map(row=>normalize(row,provider,company,checked)).filter(Boolean);
    const unique=new Map(),identities=new Map();
    for(const job of jobs){
      const previous=identities.get(job.requisitionId);
      if(previous&&previous!==job.url)throw Error('Conflicting employer job identity');
      identities.set(job.requisitionId,job.url);
      if(!unique.has(job.url))unique.set(job.url,job);
    }
    return {source,jobs:[...unique.values()]};
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

/**
 * @param {(batch:any)=>Promise<any>} publish
 * @param {{sources?:string[][],signal?:AbortSignal,fetchImpl?:typeof fetch,rotation?:number,fullSnapshots?:boolean}} [options]
 */
export async function refreshSources(publish,{sources=SOURCES,signal,fetchImpl=fetch,rotation=0,fullSnapshots=false}={}){
  const checked=new Date().toISOString();
  const runId='ats-'+randomUUID();
  const feeds=[];
  const offset=sources.length?((rotation%sources.length)+sources.length)%sources.length:0;
  sources=[...sources.slice(offset),...sources.slice(0,offset)];
  // Bound remote requests so the production cron can finish within its time budget.
  for(let i=0;i<sources.length;i+=4){
    feeds.push(...await Promise.all(sources.slice(i,i+4).map(source=>fetchEmployerFeed(source,checked,{signal,fetchImpl}))));
  }
  const selected=selectJobs(feeds);
  const outcomes=[];
  for(const feed of feeds){
    if(feed.status==='failed'){outcomes.push(feed);continue}
    const jobs=selected.get(feed.source);
    try{
      // Full snapshots publish all inventory; the bounded selection supplies featured roles.
      const receipt=await publish({source:feed.source,runId,jobs,completeSnapshot:true,...(fullSnapshots?{availableJobs:feed.jobs}:{})});
      outcomes.push({source:feed.source,status:'ok',matched:fullSnapshots?feed.jobs.length:jobs.length,featured:jobs.length,available:feed.jobs.length,receipt});
    }catch(error){outcomes.push({source:feed.source,status:'failed',error:String(error.message).slice(0,160)})}
  }
  return outcomes;
}

export function refreshSummary(sources){
  const published=sources.filter(source=>source.status==='ok').reduce((sum,source)=>sum+source.matched,0);
  return {target:DAILY_JOB_TARGET,published,shortfall:Math.max(0,DAILY_JOB_TARGET-published),failedSources:sources.filter(source=>source.status==='failed').length};
}
