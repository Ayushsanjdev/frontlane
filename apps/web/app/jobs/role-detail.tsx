'use client';
import {ArrowUpRight,Bookmark} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {CompanyLogo} from '@/components/company-logo';
import {companyPath} from '@/lib/company-info';
import type {Job} from '@/lib/types';
export default function RoleDetail({job,onClose,onSave,saved,busy}:{job:Job|null;onClose:()=>void;onSave:(job:Job)=>void;saved:boolean;busy:boolean}){
  return <Dialog open={!!job} onOpenChange={open=>!open&&onClose()}><DialogContent className="role-panel">{job&&<>
    <div className="role-panel-heading"><CompanyLogo company={job.company}/><div><a className="company-name" href={companyPath(job.source,job.company)}>{job.company}</a><DialogTitle className="detail-title">{job.title}</DialogTitle></div></div>
    <DialogDescription>{job.location} · {job.type} · {job.enrichment?.arrangement||job.mode}</DialogDescription>
    {job.availability==='closed'&&<p className="notice" role="status">This role was absent from the employer’s latest complete feed. Your saved application remains in your tracker.</p>}
    <div className="detail-pay">{job.salary}</div><div className="job-tags">{job.tags.map(tag=><span key={tag}>{tag}</span>)}</div>
    {job.enrichment?.yearsMin!==undefined&&<p>Experience: {job.enrichment.yearsMin}{job.enrichment.yearsMax?'–'+job.enrichment.yearsMax:'+'} years · extracted from employer requirements</p>}
    <div className="role-description"><h3>About the role</h3><p>{job.enrichment?.description||job.summary}</p></div>
    {!!job.enrichment?.requiredSkills?.length&&<div><h3>Required technologies</h3><p>{job.enrichment.requiredSkills.join(', ')}</p></div>}
    {!!job.enrichment?.preferredSkills?.length&&<div><h3>Preferred technologies</h3><p>{job.enrichment.preferredSkills.join(', ')}</p></div>}
    {!!job.enrichment?.benefits?.length&&<div><h3>Employer-listed benefits</h3><ul className="role-benefits">{job.enrichment.benefits.map(benefit=><li key={benefit}>{benefit}</li>)}</ul></div>}
    <div className="detail-facts"><div><small>Eligibility</small><p>{job.eligibility}</p></div><div><small>Education</small><p>{job.degree}</p></div></div>
    <p className="detail-caveat">{job.caveat}</p>
    <div className="date-grid"><span>Discovered<strong>{job.discovered}</strong></span><span>Last checked<strong>{job.checked?.slice(0,10)||'Unknown'}</strong></span><span>Employer posted<strong>{job.posted?.slice(0,10)||'Unknown'}</strong></span></div>
    <small className="muted">{job.source==='community'?'Community-submitted; verify the employer before applying.':'Source: '+job.source+'. A recent check is not an employer endorsement.'}</small>
    <div className="role-panel-actions"><Button asChild><a href={job.url} target="_blank" rel="noopener noreferrer">{job.availability==='closed'?'View employer listing':'Apply at source'}<ArrowUpRight/></a></Button><Button variant="outline" disabled={busy} onClick={()=>onSave(job)}><Bookmark/>{saved?'Open tracker':'Save role'}</Button></div>
    <small className="muted">Opening the employer site does not mark your application submitted.</small>
  </>}</DialogContent></Dialog>;
}
