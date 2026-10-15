import {companies} from '@frontlanejobs/database/companies';
import {redirect} from 'next/navigation';
import CatalogCompany from '@/components/catalog-company';
import {searchParameters} from '@/lib/explore';
import {Badge} from '@/components/ui/badge';
import {database} from '@frontlanejobs/database/client';
import {notFound} from 'next/navigation';
import {CompanyLogo} from '@/components/company-logo';
import {companyInfo} from '@/lib/company-info';
import type {Job} from '@/lib/types';
export async function generateMetadata({params}:{params:Promise<{id:string}>}){const {id}=await params;const company=companies.find(c=>c.id===id||c.sources.includes(id));return company?{title:company.name+' frontend opportunities | FrontlaneJobs',description:company.description}:{title:'Company opportunities | FrontlaneJobs'}}
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const {id}=await params;const known=companies.find(company=>company.id===id||company.sources.includes(id));
  if(known){if(id!==known.id){const query=searchParameters(await searchParams).toString();redirect('/companies/'+known.id+(query?'?'+query:''))}return <CatalogCompany company={known} search={searchParameters(await searchParams)}/>}
  if(!/^[a-z0-9:_-]{1,101}$/.test(id))notFound();let jobs:Job[]=[];
  try{jobs=(await database().query('SELECT payload FROM jobs WHERE source=$1 AND active=true ORDER BY discovered_at DESC',[id])).rows.map((row:{payload:Job})=>row.payload)}catch{return <section className="wrap workspace-page"><h1>Company unavailable</h1><p>Could not load employer details. Please try again.</p><a href="/companies">Explore companies</a></section>}
  const info=companyInfo[id],name=jobs[0]?.company;if(!name&&!info)notFound();
  return <section className="wrap workspace-page"><a className="quiet-link" href="/companies">← All companies</a><div className="company-profile-heading"><CompanyLogo company={name||info?.name||id.split(':')[1]}/><div><div className="eyebrow">{info?.industry||'EMPLOYER PROFILE'}</div><h1>{name||info?.name||id.split(':')[1]}</h1></div></div>{info&&<div className="company-about"><p>{info.description}</p><a className="quiet-link" href={info.website} target="_blank" rel="noopener noreferrer">Official company website ↗</a></div>}<p className="muted">Company information is from the linked official website. Available roles are sourced from {id}. This page does not imply an employer partnership.</p><h2 className="workspace-section-title">Selected opportunities</h2><div className="job-list">{jobs.map(job=><a className="job-card" key={job.id} href={'/jobs?job='+job.id}><h3>{job.title}</h3><p>{job.location} · {job.type}</p><div className="job-tags">{job.tags.slice(0,5).map(tag=><Badge variant="secondary" key={tag}>{tag}</Badge>)}</div><strong>{job.salary}</strong></a>)}</div>{!jobs.length&&<p>No currently selected jobs. Check the official employer website for other roles.</p>}</section>;
}
