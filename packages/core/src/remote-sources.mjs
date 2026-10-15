import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {clean,eligible} from './sources.mjs';
import {JobInput,canonicalUrl} from './ingestion.mjs';
import {enrichJob,technologyTokens} from './job-enrichment.mjs';
import {classifyRemote} from './remote-eligibility.mjs';

const names={'remoteok:public':'Remote OK','wwr:programming':'We Work Remotely','hn:whoishiring':'Hacker News'};
const frontend=title=>eligible(title,'India','');
const list=value=>value===undefined?[]:Array.isArray(value)?value:[value];
function normalize({id,title,company,location,description,url,source,posted},checked){
  title=clean(title);company=clean(company);location=clean(location);description=clean(description);
  if(!frontend(title))return null;
  const remote=classifyRemote({location,description,arrangement:'Remote',checked});
  if(!remote)return null;
  if(!id||!company)throw Error('Missing remote job identity');
  const original=canonicalUrl(url);
  const expected={'remoteok:public':'remoteok.com','wwr:programming':'weworkremotely.com','hn:whoishiring':'news.ycombinator.com'}[source];
  if(new URL(original).hostname.toLowerCase()!==expected)throw Error('Unexpected source listing URL');
  const enrichment=enrichJob({title,description,arrangement:'Remote'});
  const pay=enrichment?.compensation;
  return JobInput.parse({
    requisitionId:String(id).slice(0,200),title:title.slice(0,160),company:company.slice(0,120),
    location:(location||(remote.scope==='worldwide'?'Worldwide':'India')).slice(0,200),mode:'Remote',
    type:/freelanc/i.test(title+' '+description)?'Freelance':/part[ -]?time/i.test(title+' '+description)?'Part-time':/\bcontract(?:or)?\b/i.test(title+' '+description)?'Contract':'Full-time',
    salary:pay?pay.currency+' '+pay.min.toLocaleString('en-IN')+(pay.max!==pay.min?'–'+pay.max.toLocaleString('en-IN'):'')+' / '+pay.period:'Not disclosed',
    tags:technologyTokens(title+' '+description),experience:'See source requirements',summary:description.slice(0,1500),
    caveat:'Review the original listing, geographic eligibility and working hours before applying.',url:original,checked,
    posted:posted&&!Number.isNaN(Date.parse(posted))&&Date.parse(posted)<=Date.parse(checked)?new Date(posted).toISOString():null,
    eligibility:remote.scope==='worldwide'?'Worldwide remote':'Remote — India eligible',degree:'Review source requirements',enrichment,
    remote:{...remote,sourceName:names[source],sourceUrl:original},
  });
}
export function parseRemoteOk(data,checked){
  if(!Array.isArray(data)||data.length>5000)throw Error('Invalid Remote OK feed');
  const jobs=[];
  for(const row of data){
    if(row?.legal&&!row.id)continue;
    if(!row||typeof row!=='object'||typeof row.position!=='string')throw Error('Invalid Remote OK record');
    const job=normalize({id:row.id,title:row.position,company:row.company,location:row.location,description:row.description,url:row.url,source:'remoteok:public',posted:row.date},checked);
    if(job)jobs.push(job);
  }
  return unique(jobs);
}
export function parseWwr(xml,checked){
  if(/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)throw Error('Invalid WWR RSS');
  const data=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,processEntities:false}).parse(xml);
  if(!data.rss?.channel)throw Error('Invalid WWR channel');
  const items=list(data.rss.channel.item);
  if(items.length>5000)throw Error('WWR feed too large');
  const jobs=[];
  for(const row of items){
    if(typeof row.title!=='string'||typeof row.link!=='string')throw Error('Invalid WWR record');
    const separator=row.title.indexOf(':');
    if(separator<1)continue;
    const title=row.title.slice(separator+1).trim(),company=row.title.slice(0,separator).trim();
    const description=typeof row.encoded==='string'?row.encoded:typeof row.description==='string'?row.description:'';
    const job=normalize({id:typeof row.guid==='string'?row.guid:row.link,title,company,location:row.region||row.location||'',description,url:row.link,source:'wwr:programming',posted:row.pubDate},checked);
    if(job)jobs.push(job);
  }
  return unique(jobs);
}
export function parseHnComment(row,threadId,checked){
  if(!row||row.dead||row.deleted||String(row.parent_id)!==String(threadId)||typeof row.comment_text!=='string')return [];
  const html=row.comment_text,header=clean(html.split(/<p\b|<br\b|\n/i)[0]);
  const parts=header.split('|').map(s=>s.trim()).filter(Boolean);
  if(parts.length<2||!parts.some(p=>/\bremote\b/i.test(p)))return [];
  const titles=parts.slice(1).filter(frontend);
  // A header must identify a single role; don't assign shared eligibility to unrelated openings.
  if(titles.length!==1||/\bbackend\b|back[- ]end|\bdevops\b|data engineer|(?:engineer|developer)\s*(?:,|\/|\band\b|&)/i.test(titles[0]))return [];
  const job=normalize({id:row.objectID,title:titles[0],company:parts[0],location:parts.filter(p=>/remote|worldwide|anywhere|\bIndia\b/i.test(p)).join(' · '),description:html,url:'https://news.ycombinator.com/item?id='+encodeURIComponent(row.objectID),source:'hn:whoishiring',posted:row.created_at},checked);
  return job?[job]:[];
}
function unique(jobs){
  const ids=new Map(),urls=new Set(),result=[];
  for(const job of jobs){
    if(ids.has(job.requisitionId)&&ids.get(job.requisitionId)!==job.url)throw Error('Conflicting source identity');
    ids.set(job.requisitionId,job.url);
    if(!urls.has(job.url)){urls.add(job.url);result.push(job)}
  }
  return result;
}
async function readBody(response,signal){
  if(Number(response.headers.get('content-length'))>8_000_000)throw Error('Remote feed too large');
  const reader=response.body?.getReader();if(!reader)throw Error('Empty feed response');
  const chunks=[];let size=0;
  try{
    for(;;){signal.throwIfAborted();const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>8_000_000)throw Error('Remote feed too large');chunks.push(value)}
  }catch(error){await reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return new TextDecoder().decode(bytes);
}
export async function fetchRemoteFeeds({checked=new Date().toISOString(),fetchImpl=fetch,signal=AbortSignal.timeout(25000)}={}){
  async function get(url,json=true){
    const deadline=AbortSignal.any([signal,AbortSignal.timeout(8000)]);
    const response=await fetchImpl(url,{signal:deadline,redirect:'error',headers:{Accept:json?'application/json':'application/rss+xml', 'User-Agent':'FrontlaneJobs/1.0 (public job feed reader)'}});
    if(!response.ok)throw Error('Remote feed HTTP '+response.status);
    const body=await readBody(response,deadline);return json?JSON.parse(body):body;
  }
  async function hn(){
    const threads=await get('https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=Who%20is%20hiring&hitsPerPage=12');
    if(!Array.isArray(threads.hits))throw Error('Invalid HN threads');
    const selected=threads.hits.filter(row=>row.author==='whoishiring'&&/^Ask HN: Who is hiring\? \(/.test(row.title||'')&&/^\d+$/.test(row.objectID)).slice(0,2);
    if(!selected.length)throw Error('HN hiring threads unavailable');
    const jobs=[];let partial=false;
    for(const thread of selected){
      for(let page=0;page<10;page++){
        const data=await get(`https://hn.algolia.com/api/v1/search_by_date?tags=comment,story_${thread.objectID}&hitsPerPage=100&page=${page}`);
        if(!Array.isArray(data.hits)||!Number.isInteger(data.nbPages))throw Error('Invalid HN comments');
        for(const row of data.hits)jobs.push(...parseHnComment(row,thread.objectID,checked));
        if(page+1>=data.nbPages)break;
        if(page===9)partial=true;
      }
    }
    return {jobs:unique(jobs),partial};
  }
  return Promise.all([
    ['remoteok:public',async()=>({jobs:parseRemoteOk(await get('https://remoteok.com/api'),checked)})],
    ['wwr:programming',async()=>({jobs:parseWwr(await get('https://weworkremotely.com/categories/remote-programming-jobs.rss',false),checked)})],
    ['hn:whoishiring',hn],
  ].map(async([source,load])=>{
    try{const result=await load();return {source,status:result.partial?'partial':'ok',jobs:result.jobs}}
    catch(error){return {source,status:'failed',error:String(error.message).slice(0,160)}}
  }));
}
