import {useRef,useState} from 'react';
import {router} from 'expo-router';
import * as Crypto from 'expo-crypto';
import type {Job} from '@frontlanejobs/contracts';
import {AuthGate,Button,Choices,Field,Notice,Screen,Txt} from '../src/ui';
import {useApp} from '../src/providers';
import {publicationAttempt} from '../src/operations.mjs';
const empty={title:'',company:'',url:'',location:'',mode:'Remote',type:'Full-time',salary:'',summary:'',tags:'',experience:'',eligibility:'',degree:''};
const fields=[['title','Job title',160],['company','Company',120],['url','HTTPS application link',2000],['location','Location',200],['salary','Salary or budget (optional)',160],['summary','Description (40–1,500 characters)',1500],['tags','Skills, separated by commas (optional)',600],['experience','Experience (optional)',160],['eligibility','Who can apply? (optional)',400],['degree','Education (optional)',300]] as const;
export default function Publish(){
  const {user,request}=useApp();const [form,setForm]=useState(empty),[busy,setBusy]=useState(false),[error,setError]=useState('');const attempt=useRef(publicationAttempt(()=>Crypto.randomUUID()));
  const update=(key:keyof typeof empty,value:string)=>{if(!busy)setForm(current=>({...current,[key]:value}))};
  async function publish(){
    if(busy)return;
    if(form.title.trim().length<2||!form.company.trim()||form.location.trim().length<2||form.summary.trim().length<40){setError('Add a title, company, location, and a description of at least 40 characters.');return}
    try{const url=new URL(form.url.trim());if(url.protocol!=='https:'||url.username||url.password)throw Error()}catch{setError('Use an HTTPS application link without embedded credentials.');return}
    const tags=form.tags.split(',').map(tag=>tag.trim()).filter(Boolean);
    if(tags.length>15||tags.some(tag=>tag.length>40)){setError('Use up to 15 skills, each no longer than 40 characters.');return}
    setBusy(true);setError('');
    try{
      const result=await request<{job:Job}>('/api/jobs',{method:'POST',body:attempt.current.get({...form,url:form.url.trim(),tags})});
      if(!result.job)throw Error('Publication could not be confirmed. Retry the same submission.');
      router.replace({pathname:'/jobs/[id]',params:{id:result.job.id}});
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not publish the job. Try again.')}
    finally{setBusy(false)}
  }
  if(!user)return <Screen><Txt tone="title">Share an opportunity.</Txt><AuthGate message="Sign in to publish a frontend job for India or worldwide."/></Screen>;
  return <Screen><Txt tone="title">Help someone{ '\n'}find their lane.</Txt><Txt tone="muted">Publish a frontend opportunity for people in India or worldwide. Your listing will be public.</Txt>
    {fields.slice(0,4).map(([key,label,maxLength])=><Field key={key} label={label} value={form[key]} onChangeText={value=>update(key,value)} maxLength={maxLength} editable={!busy} autoCapitalize={key==='url'?'none':'sentences'} keyboardType={key==='url'?'url':'default'}/>)}
    <Choices label="Work arrangement" value={form.mode} options={['Remote','Hybrid','Onsite']} onChange={value=>update('mode',value)}/><Choices label="Employment type" value={form.type} options={['Full-time','Freelance','Part-time','Contract']} onChange={value=>update('type',value)}/>
    {fields.slice(4).map(([key,label,maxLength])=><Field key={key} label={label} value={form[key]} onChangeText={value=>update(key,value)} maxLength={maxLength} editable={!busy} multiline={key==='summary'}/>)}
    <Notice message={error} error/><Txt tone="muted">Published as a community listing. Up to 10 jobs per account each UTC day.</Txt><Button title="Publish job" icon="add" busy={busy} onPress={()=>void publish()}/>
  </Screen>;
}
