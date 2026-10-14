import {clean,fetchEmployerFeed} from './sources.mjs';

const providers=new Map([['boards.greenhouse.io','greenhouse'],['job-boards.greenhouse.io','greenhouse'],['jobs.lever.co','lever'],['jobs.smartrecruiters.com','smartrecruiters']]);
export function parseBoardUrl(value){
  try{
    if(typeof value!=='string'||value.length>2000||/%(?:2e|2f|5c)/i.test(value))return null;
    const url=new URL(value),provider=providers.get(url.hostname);
    if(url.protocol!=='https:'||url.username||url.password||url.port||!provider)return null;
    const parts=url.pathname.split('/').filter(Boolean);
    let slug;
    if(provider==='greenhouse'&&parts[0]==='embed'&&['job_app','job_board'].includes(parts[1])&&parts.length===2)slug=url.searchParams.get('for');
    else{
      slug=decodeURIComponent(parts[0]||'');
      if(provider==='greenhouse'&&!(parts.length===1||parts.length===3&&parts[1]==='jobs'&&/^\d+$/.test(parts[2])))return null;
      if(provider==='lever'&&!(parts.length===1||parts.length===2&&/^[a-z0-9-]{8,100}$/i.test(parts[1])))return null;
      if(provider==='smartrecruiters'&&!(parts.length===1||parts.length===2&&/^\d+[a-z0-9-]*$/i.test(parts[1])))return null;
    }
    if(!slug||!/^[a-z0-9][a-z0-9_-]{0,80}$/i.test(slug)||/^(robots|sitemap|embed|jobs|search|privacy|terms|api|www)$/i.test(slug))return null;
    const host=provider==='greenhouse'?'job-boards.greenhouse.io':provider==='lever'?'jobs.lever.co':'jobs.smartrecruiters.com';
    return {provider,slug,source:provider+':'+slug.toLowerCase(),boardUrl:`https://${host}/${encodeURIComponent(slug)}`};
  }catch{return null}
}

async function readResponse(url,fetchImpl,signal,{html=false}={}){
  signal?.throwIfAborted();
  const response=await fetchImpl(url,{redirect:'error',signal});
  if(!response.ok||response.redirected)throw Error('Employer identity unavailable');
  if(!html)return response.json();
  const reader=response.body?.getReader();
  if(!reader)throw Error('Employer identity unavailable');
  const chunks=[];let size=0;
  try{
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>500000)throw Error('Employer identity too large');chunks.push(value)}
  }finally{await reader.cancel()}
  return new TextDecoder().decode(Buffer.concat(chunks));
}
function companyName(value){
  if(typeof value!=='string')return null;
  const name=clean(value).trim();
  return name.length>1&&name.length<=120&&!/https?:|<|>|\b((?:frontend|react|angular|vue|ui|web|software)\s+(?:engineer|developer)|job search|access denied|not found|error|loading)\b/i.test(name)?name:null;
}

export async function verifyCandidate(candidate,{signal,fetchImpl=fetch,now=new Date()}={}){
  try{
    signal?.throwIfAborted();
    const board=parseBoardUrl(candidate.board_url||candidate.boardUrl||`https://${candidate.provider==='greenhouse'?'job-boards.greenhouse.io':candidate.provider==='lever'?'jobs.lever.co':'jobs.smartrecruiters.com'}/${candidate.slug}`);
    if(!board||board.source!==candidate.source||board.provider!==candidate.provider)throw Error('Invalid employer board');
    const slug=encodeURIComponent(board.slug);
    let company;
    if(board.provider==='greenhouse'){
      company=companyName((await readResponse(`https://boards-api.greenhouse.io/v1/boards/${slug}`,fetchImpl,signal)).name);
    }else if(board.provider==='lever'){
      const html=await readResponse(board.boardUrl,fetchImpl,signal,{html:true});
      const title=clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
      company=companyName(title.match(/^Jobs at (.+)$/i)?.[1]||title.match(/^(.+?)\s*[-–|]\s*(?:Jobs|Careers|Job openings)$/i)?.[1]);
      if(!company){
        const metadata=html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1]||html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["'][^>]*>/i)?.[1];
        if(metadata&&clean(metadata).trim()===title)company=companyName(title);
      }
    }else{
      const data=await readResponse(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?country=in&limit=1`,fetchImpl,signal);
      company=companyName(data.content?.[0]?.company?.name);
    }
    if(!company)return {status:'pending',error:'Employer identity could not be verified'};
    const feed=await fetchEmployerFeed([board.provider,board.slug,company],now.toISOString(),{signal,fetchImpl,retries:false});
    if(feed.status==='failed')return {status:'failed',error:'Employer feed unavailable or malformed'};
    if(!feed.jobs.length)return {status:'no-match',company,matched:0};
    if(feed.jobs.some(job=>parseBoardUrl(job.url)?.source!==board.source))return {status:'pending',error:'Application board attribution needs verification'};
    return {status:'verified',company,matched:feed.jobs.length};
  }catch{return {status:'failed',error:signal?.aborted?'Verification deferred after deadline':'Employer verification unavailable'}}
}
