'use client';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';

import {useRef,useState} from 'react';
import {ArrowUpRight,LoaderCircle,Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import type {Job} from '@/lib/types';

const emptyForm={title:'',company:'',url:'',location:'',mode:'Remote',type:'Full-time',salary:'',summary:'',tags:'',experience:'',eligibility:'',degree:''};
type Props={open:boolean;signedIn:boolean;onOpenChange:(open:boolean)=>void;onPublished:(job:Job)=>void};

export default function PublishJobDialog({open,signedIn,onOpenChange,onPublished}:Props){
  const [form,setForm]=useState(emptyForm),[busy,setBusy]=useState(false),[error,setError]=useState(''),[expired,setExpired]=useState(false);
  const attempt=useRef<{body:string;id:string}|null>(null);
  const update=(key:keyof typeof emptyForm,value:string)=>setForm(current=>({...current,[key]:value}));
  const changeOpen=(value:boolean)=>{if(!busy){setError('');setExpired(false);onOpenChange(value)}};
  const signInUrl='/signin?returnTo=%2Fjobs%3Fpost%3D1';

  async function publish(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');setExpired(false);
    const fields={...form,url:form.url.trim(),tags:form.tags.split(',').map(tag=>tag.trim()).filter(Boolean)};
    const body=JSON.stringify(fields);
    if(attempt.current?.body!==body)attempt.current={body,id:crypto.randomUUID()};
    try{
      const response=await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...fields,submissionId:attempt.current.id})});
      const result=await response.json() as {job?:Job;error?:string};
      if(!response.ok){
        if(response.status===401)setExpired(true);
        throw Error(result.error||'Could not publish this job. Please try again.');
      }
      if(!result.job)throw Error('Publication could not be confirmed. Retry to check the same submission.');
      onOpenChange(false);onPublished(result.job);setForm(emptyForm);attempt.current=null;
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not publish this job. Please try again.')}
    finally{setBusy(false)}
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogContent className="publish-job-dialog" showCloseButton={!busy} onEscapeKeyDown={event=>{if(busy)event.preventDefault()}} onPointerDownOutside={event=>{if(busy)event.preventDefault()}}>
      <DialogTitle>{signedIn?'Add a job':'Share an opportunity'}</DialogTitle>
      <DialogDescription>{signedIn?'Publish a frontend opportunity for people in India or worldwide. Your listing will be visible to everyone.':'Sign in with Google to publish a job on the public board.'}</DialogDescription>
      {!signedIn?<Button asChild><a href={signInUrl} target="_top">Sign in to publish <ArrowUpRight/></a></Button>:<form onSubmit={publish} aria-busy={busy}>
        <fieldset disabled={busy} className="publish-fields">
          <div className="form-grid">
            <label>Job title<Input required maxLength={160} autoComplete="off" placeholder="e.g. Frontend Engineer" value={form.title} onChange={event=>update('title',event.target.value)}/></label>
            <label>Company<Input required maxLength={120} autoComplete="organization" placeholder="Company name" value={form.company} onChange={event=>update('company',event.target.value)}/></label>
          </div>
          <label>Application link<Input type="url" required maxLength={2000} placeholder="https://company.com/careers/role" value={form.url} onChange={event=>update('url',event.target.value)}/></label>
          <div className="form-grid">
            <label>Location<Input required maxLength={200} placeholder="e.g. Bengaluru, India or Worldwide" value={form.location} onChange={event=>update('location',event.target.value)}/></label>
            <label>Work arrangement<NativeSelect value={form.mode} onChange={event=>update('mode',event.target.value)}>{['Remote','Hybrid','Onsite'].map(value=><NativeSelectOption key={value}>{value}</NativeSelectOption>)}</NativeSelect></label>
          </div>
          <div className="form-grid">
            <label>Employment type<NativeSelect value={form.type} onChange={event=>update('type',event.target.value)}>{['Full-time','Freelance','Part-time','Contract'].map(value=><NativeSelectOption key={value}>{value}</NativeSelectOption>)}</NativeSelect></label>
            <label>Salary or budget <span className="publish-optional">(optional)</span><Input maxLength={160} placeholder="e.g. ₹15–25 LPA or Not disclosed" value={form.salary} onChange={event=>update('salary',event.target.value)}/></label>
          </div>
          <label>Job description<Textarea required minLength={40} maxLength={1500} rows={4} placeholder="Describe the role, responsibilities and requirements. Include any country or working-hour restrictions." value={form.summary} onChange={event=>update('summary',event.target.value)}/><span className="publish-field-hint">40–1,500 characters · {form.summary.length}/1,500</span></label>
          <details className="publish-more"><summary>More details <span className="publish-optional">(optional)</span></summary>
            <label>Skills<Input maxLength={600} placeholder="React, TypeScript, Next.js" value={form.tags} onChange={event=>update('tags',event.target.value)}/><span className="publish-field-hint">Up to 15 skills, separated by commas.</span></label>
            <div className="form-grid">
              <label>Experience<Input maxLength={160} placeholder="e.g. 2–4 years" value={form.experience} onChange={event=>update('experience',event.target.value)}/></label>
              <label>Education<Input maxLength={300} placeholder="Degree or equivalent experience" value={form.degree} onChange={event=>update('degree',event.target.value)}/></label>
            </div>
            <label>Who can apply?<Input maxLength={400} placeholder="Country eligibility or work authorization requirements" value={form.eligibility} onChange={event=>update('eligibility',event.target.value)}/></label>
          </details>
        </fieldset>
        {error&&<div className="form-error" role="alert">{error}{expired&&<p><a className="quiet-link" href={signInUrl} target="_top">Sign in again <ArrowUpRight size={14}/></a></p>}</div>}
        <div className="publish-footer"><p>Published as a community listing.<br/>Up to 10 jobs per account each day.</p><Button type="submit" disabled={busy}>{busy?<LoaderCircle className="animate-spin"/>:<Plus/>}{busy?'Publishing…':'Publish job'}</Button></div>
      </form>}
    </DialogContent>
  </Dialog>;
}
