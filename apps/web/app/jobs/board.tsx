'use client';
import {useEffect,useState} from 'react';
import {Search,ArrowUpRight,Bookmark,MapPin,SlidersHorizontal,X,Plus,Mail,EyeOff} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {productEvent} from '@/lib/product-event';
import {CompanyLogo} from '@/components/company-logo';
import {companyPath} from '@/lib/company-info';
import type {Job,JobCollection} from '@/lib/types';
import PublishJobDialog from './publish-job-dialog';
import RoleDetail from './role-detail';
import SaveSearchDialog from './save-search-dialog';
type DiscoverJob=Job&{matchReasons?:string[];matchUnknowns?:string[]};
const stacks=['React','Next.js','TypeScript','React Native','Tailwind','JavaScript','Angular','Vue','Svelte'];
export default function Board({signedIn,initialCollection,initialType,initialParameters=''}:{signedIn:boolean;initialCollection:JobCollection;initialType:string;initialParameters?:string}){
  const [search,setSearch]=useState(initialParameters||new URLSearchParams({type:initialType}).toString());
  const params=new URLSearchParams(search),[collection,setCollection]=useState(new URLSearchParams(initialParameters).get('view')==='for-you'?{...initialCollection,jobs:[],total:0}:initialCollection),[selected,setSelected]=useState<Job|null>(null),[saved,setSaved]=useState<string[]>([]),[saving,setSaving]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(new URLSearchParams(initialParameters).get('view')==='for-you'),[retry,setRetry]=useState(0),[publishing,setPublishing]=useState(false),[setup,setSetup]=useState(false),[showFilters,setShowFilters]=useState(false),[compare,setCompare]=useState<string[]>([]);
  const forYou=params.get('view')==='for-you',page=Number(params.get('page'))||1;
  function update(key:string,value:string|string[],replace=false){
    const next=new URLSearchParams(search);next.delete(key);
    if(key==='view'){setCollection(current=>({...current,jobs:[],total:0,warning:undefined}));setLoading(true)}
    for(const entry of Array.isArray(value)?value:[value])if(entry&&entry!=='All')next.append(key,entry);
    if(key!=='job'&&key!=='page')next.delete('page');
    if(key==='salaryMin'&&value){if(!next.has('currency'))next.set('currency','INR');if(!next.has('payPeriod'))next.set('payPeriod','year')}
    const valueString=next.toString();setSearch(valueString);
    history[replace?'replaceState':'pushState'](null,'','/jobs'+(valueString?'?'+valueString:''));
  }
  function clear(){const next=forYou?'view=for-you':'';setSearch(next);history.pushState(null,'','/jobs'+(next?'?'+next:''))}
  useEffect(()=>{const pop=()=>setSearch(location.search.slice(1));window.addEventListener('popstate',pop);if(new URLSearchParams(location.search).get('post')==='1')setPublishing(true);return()=>window.removeEventListener('popstate',pop)},[]);
  useEffect(()=>{if(!signedIn)return;fetch('/api/tracker').then(async r=>r.ok?r.json():[]).then((rows:{jobId:string}[])=>setSaved(rows.map(row=>row.jobId))).catch(()=>{})},[signedIn]);
  const listParams=new URLSearchParams(search);listParams.delete('job');listParams.delete('post');listParams.set('limit','12');const searchKey=listParams.toString();
  useEffect(()=>{
    const controller=new AbortController();const timer=setTimeout(async()=>{setLoading(true);setError('');try{
      const response=await fetch((forYou?'/api/recommendations?':'/api/jobs?')+searchKey,{signal:controller.signal,cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not refresh these jobs.');setSetup(!!data.needsPreferences);setCollection(data);if(!forYou)productEvent('search');
    }catch(e){if((e as Error).name!=='AbortError')setError('Could not refresh these jobs. The previous results are shown below.')}finally{if(!controller.signal.aborted)setLoading(false)}},200);
    return()=>{clearTimeout(timer);controller.abort()};
  },[searchKey,forYou,retry]);
  const selectedId=params.get('job');
  useEffect(()=>{if(!selectedId){setSelected(null);return}const controller=new AbortController();fetch('/api/jobs?id='+encodeURIComponent(selectedId),{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('This role is no longer available.');return r.json()}).then(data=>(setSelected(data.job),productEvent('role-view'))).catch(e=>{if(e.name!=='AbortError')setNotice(e.message)});return()=>controller.abort()},[selectedId]);
  async function save(job:Job){
    if(!signedIn){location.href='/signin?returnTo='+encodeURIComponent('/jobs?'+search);return}
    if(saved.includes(job.id)){location.href='/tracker';return}setSaving(job.id);
    try{const response=await fetch('/api/tracker',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',job:{...job,matchReasons:undefined,matchUnknowns:undefined}})});const data=await response.json();if(!response.ok)throw Error(data.error);setSaved(current=>[...current,job.id]);setNotice('Saved to your private tracker.')}catch(e){setNotice((e as Error).message)}finally{setSaving('')}
  }
  async function hide(job:Job,kind:'job'|'company'){
    try{const response=await fetch('/api/job-feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,target:kind==='job'?job.id:job.company})});if(!response.ok)throw Error('Could not hide this result.');setRetry(v=>v+1)}catch(e){setNotice((e as Error).message)}
  }
  const filters=[...params.entries()].filter(([key,value])=>['q','type','mode','stack','city','seniority','compensationKnown','salaryMin','currency','payPeriod'].includes(key)&&value&&value!=='All');
  return <div className="board-shell wrap discovery-page">
    <div className="workspace-heading"><div><div className="eyebrow">FRONTEND CAREERS · INDIA</div><h1>Find your lane<span>.</span></h1><p>Useful details. Direct employer links. Your next move.</p></div><a className="quiet-link" href="/account#email"><Mail size={17}/>New jobs in your inbox</a></div>
    <div className="discovery-search"><Search size={21}/><input aria-label="Search jobs" value={params.get('q')||''} placeholder="Role, company, technology or city" onChange={e=>update('q',e.target.value,true)}/><button aria-expanded={showFilters} onClick={()=>setShowFilters(!showFilters)}><SlidersHorizontal size={18}/>Filters</button></div>
    <div className="workspace-tabs"><button className={!forYou?'active':''} onClick={()=>update('view','')}>All opportunities</button>{signedIn&&<button className={forYou?'active':''} onClick={()=>update('view','for-you')}>For you</button>}<a href="/companies">Explore companies<ArrowUpRight size={14}/></a></div>
    <div className="board-body discovery-body"><aside className={'filters discovery-filters '+(showFilters?'filters-open':'')}>
      <div className="filter-title"><strong>Refine your search</strong><button onClick={clear}>Clear all</button></div>
      <label className="filter-control">Employment<select value={params.get('type')||'All'} onChange={e=>update('type',e.target.value)}>{['All','Full-time','Freelance','Part-time','Contract'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="filter-control">Arrangement<select value={params.get('mode')||'All'} onChange={e=>update('mode',e.target.value)}>{['All','Remote','Hybrid','Onsite'].map(v=><option key={v}>{v}</option>)}</select></label>
      <fieldset><legend>Technologies · match any</legend>{stacks.map(stack=><label key={stack}><input type="checkbox" checked={params.getAll('stack').includes(stack)} onChange={e=>update('stack',e.target.checked?[...params.getAll('stack'),stack]:params.getAll('stack').filter(v=>v!==stack))}/>{stack}</label>)}</fieldset>
      <label className="filter-control">City<input value={params.get('city')||''} placeholder="e.g. Bengaluru" onChange={e=>update('city',e.target.value,true)}/></label>
      <label className="filter-control">Seniority<select value={params.get('seniority')||''} onChange={e=>update('seniority',e.target.value)}><option value="">Any level</option>{['Junior','Mid','Senior','Lead','Staff'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label className="filter-check"><input type="checkbox" checked={params.get('compensationKnown')==='1'} onChange={e=>update('compensationKnown',e.target.checked?'1':'')}/>Disclosed salary only</label>
      <label className="filter-control">Minimum pay<input type="number" min="0" value={params.get('salaryMin')||''} onChange={e=>update('salaryMin',e.target.value,true)} placeholder="Employer range maximum"/></label>
      <div className="filter-money"><select aria-label="Salary currency" value={params.get('currency')||'INR'} onChange={e=>update('currency',e.target.value)}>{['INR','USD','EUR','GBP'].map(v=><option key={v}>{v}</option>)}</select><select aria-label="Salary period" value={params.get('payPeriod')||'year'} onChange={e=>update('payPeriod',e.target.value)}>{['year','month','hour'].map(v=><option key={v}>{v}</option>)}</select></div>
      <p className="muted">Unknown facts stay unknown. Salary comparisons use the selected currency and period.</p><a className="source-link" href="/updates">Sources & check status<ArrowUpRight size={14}/></a>
    </aside><section className="results" aria-busy={loading}>
      {!!filters.length&&<div className="active-filters">{filters.map(([key,value],index)=><button key={key+value+index} onClick={()=>update(key,key==='stack'?params.getAll(key).filter(v=>v!==value):'')}>{key==='compensationKnown'?'Disclosed salary':key==='salaryMin'?'Minimum '+value:value}<X size={13}/></button>)}<button onClick={clear}>Clear all</button></div>}
      <div className="results-toolbar"><span><b>{collection.total}</b> opportunities{loading?' · Updating…':''}</span><div className="results-actions"><SaveSearchDialog signedIn={signedIn} search={search} onSaved={()=>setNotice('Search saved. Manage alerts in your inbox.')}/><Button size="sm" onClick={()=>setPublishing(true)}><Plus/>Add a job</Button>{!forYou&&<select aria-label="Sort jobs" value={params.get('sort')||'recommended'} onChange={e=>update('sort',e.target.value)}><option value="recommended">Relevant</option><option value="newest">Recently discovered</option><option value="remote">Remote first</option></select>}</div></div>
      {error&&<div className="notice" role="alert">{error}<button onClick={()=>setRetry(v=>v+1)}>Retry</button></div>}
      {(notice||collection.warning)&&<div className="notice" role="status">{notice||collection.warning}<button aria-label="Dismiss notice" onClick={()=>{setNotice('');setCollection(v=>({...v,warning:undefined}))}}><X size={15}/></button></div>}
      {forYou&&<div className="match-banner"><span>{loading?'Finding matches based on your preferences…':setup?'Set your preferences to find relevant roles.':'Matches based on your preferences. Missing information is shown honestly.'}</span><a href="/account#preferences">{setup?'Set preferences':'Edit preferences'}<ArrowUpRight size={14}/></a></div>}
      <div className="job-list">{(collection.jobs as DiscoverJob[]).map(job=><article className="job-card discovery-card" key={job.id}>
        <div className="job-top"><CompanyLogo company={job.company}/><div className="job-main"><a className="company-name" href={companyPath(job.source,job.company)}>{job.company}</a><button className="job-title" onClick={()=>update('job',job.id)}>{job.title}</button></div><button className={'bookmark '+(saved.includes(job.id)?'is-saved':'')} aria-label={saved.includes(job.id)?'Open saved job':'Save '+job.title} disabled={saving===job.id} onClick={()=>save(job)}><Bookmark size={19} fill={saved.includes(job.id)?'currentColor':'none'}/></button></div>
        <div className="job-meta"><span><MapPin size={14}/>{job.location}</span><span className="arrangement-badge">{job.enrichment?.arrangement||job.mode}</span><span>{job.type}</span>{job.enrichment?.seniority&&<span>{job.enrichment.seniority}</span>}{job.enrichment?.yearsMin!==undefined&&<span>{job.enrichment.yearsMin}{job.enrichment.yearsMax!==undefined?'–'+job.enrichment.yearsMax:'+'} years</span>}</div>
        <div className="job-tags">{job.tags.slice(0,4).map(tag=><span key={tag}>{tag}</span>)}{job.tags.length>4&&<span>+{job.tags.length-4}</span>}</div>
        {job.matchReasons?.length?<p className="match-reason">{job.matchReasons.slice(0,2).join(' · ')}</p>:null}
        <div className="job-bottom"><strong>{job.salary}</strong><span className="checked">{job.source==='community'?'Community listing':job.checked?'Checked '+new Date(job.checked).toLocaleDateString('en-IN',{day:'numeric',month:'short'}):'Check employer'}</span><button onClick={()=>update('job',job.id)}>View role<ArrowUpRight size={15}/></button></div>
        <div className="card-secondary"><label><input type="checkbox" checked={compare.includes(job.id)} disabled={!compare.includes(job.id)&&compare.length===3} onChange={e=>setCompare(v=>e.target.checked?[...v,job.id]:v.filter(id=>id!==job.id))}/>Compare</label>{forYou&&<><button onClick={()=>hide(job,'job')}><EyeOff size={13}/>Hide role</button><button onClick={()=>hide(job,'company')}>Hide company</button></>}</div>
      </article>)}</div>
      {!collection.jobs.length&&!loading&&<div className="empty-state"><Search size={30}/><h3>{setup?'Find roles that fit your preferences.':'No roles match this search yet.'}</h3><p>{setup?'Choose your skills and work preferences to get started.':'Try fewer filters, or save this search for new opportunities.'}</p><Button variant="outline" onClick={clear}>Clear filters</Button></div>}
      {collection.total>12&&<div className="pagination"><Button variant="outline" disabled={page<=1||loading} onClick={()=>update('page',String(page-1))}>Previous</Button><span>{page} / {Math.ceil(collection.total/12)}</span><Button variant="outline" disabled={page*12>=collection.total||loading} onClick={()=>update('page',String(page+1))}>Next</Button></div>}
      <p className="feed-note">Discovery dates are not employer posting dates. Applications go directly to employers.</p>
    </section></div>
    {!!compare.length&&<div className="compare-dock"><span>{compare.length} / 3 roles selected</span>{compare.length>=2&&<Button asChild><a href={'/compare?'+compare.map(id=>'job='+encodeURIComponent(id)).join('&')}>Compare roles<ArrowUpRight/></a></Button>}<button onClick={()=>setCompare([])}>Clear</button></div>}
    <RoleDetail job={selected} saved={!!selected&&saved.includes(selected.id)} busy={saving===selected?.id} onSave={save} onClose={()=>update('job','')}/>
    <PublishJobDialog open={publishing} signedIn={signedIn} onOpenChange={setPublishing} onPublished={job=>{setRetry(v=>v+1);setNotice('Your job is now public.');update('job',job.id)}}/>
  </div>;
}
