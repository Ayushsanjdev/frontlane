'use client';
import {useEffect,useState} from 'react';
import {Bell,Mail} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Input} from '@/components/ui/input';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {MatchingPreferences} from '@frontlanejobs/contracts';
type Status={reviewed:boolean;hasPreferences:boolean;preferences:MatchingPreferences|null;email:{available:boolean;enabled:boolean;mode:'matching'|'all'};push:{available:boolean;enabled:boolean;mode:'matching'|'all';publicKey:string|null}};
async function api(path:string,body?:unknown,method='POST'){
  const response=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save preferences.');return data;
}
export default function NotificationSettings({onboarding=false}:{onboarding?:boolean}){
  const [status,setStatus]=useState<Status|null>(null),[open,setOpen]=useState(false),[email,setEmail]=useState(false),[push,setPush]=useState(false),[mode,setMode]=useState<'matching'|'all'>('matching');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[supported,setSupported]=useState(false),[blocked,setBlocked]=useState(false),[skills,setSkills]=useState(''),[arrangements,setArrangements]=useState<string[]>([]);
  useEffect(()=>{
    let active=true;
    setSupported(window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window);
    setBlocked('Notification' in window&&Notification.permission==='denied');
    const load=()=>fetch('/api/notification-preferences').then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);if(!active)return;setStatus(data);setEmail(data.email.enabled);setPush(data.push.enabled);setMode(data.email.enabled?data.email.mode:data.push.enabled?data.push.mode:'matching');setSkills(data.preferences?.skills?.join(', ')||'');setArrangements(data.preferences?.arrangements||[]);setOpen(!data.reviewed);}).catch(()=>{if(active&&!onboarding)setMessage('Notification settings could not be loaded. Refresh to try again.');});
    void load();window.addEventListener('frontlane-notification-settings',load);
    return ()=>{active=false;window.removeEventListener('frontlane-notification-settings',load)};
  },[onboarding]);
  async function dismiss(){if(busy)return;setBusy(true);try{await api('/api/notification-preferences',{reviewed:true});setOpen(false);window.dispatchEvent(new Event('frontlane-notification-settings'))}catch(e){setMessage((e as Error).message)}finally{setBusy(false)}}
  async function save(){
    if(!status)return;
    // Call permission directly from the user's Save gesture, before other requests.
    const permission=push&&supported?Notification.requestPermission():Promise.resolve('default' as NotificationPermission);
    setBusy(true);setMessage('');
    let newlyCreated:PushSubscription|null=null;
    try{
      const granted=await permission;
      const pushDenied=push&&(!supported||granted!=='granted');
      if(pushDenied)setBlocked(granted==='denied');
      if((email||push&&!pushDenied)&&mode==='matching'&&!status.hasPreferences){
        const list=skills.split(',').map(v=>v.trim()).filter(Boolean);
        if(!list.length&&!arrangements.length)throw Error('Choose at least one skill or work arrangement to find matching jobs.');
        await api('/api/profile',{matchingPreferences:{skills:list,roles:[],cities:[],arrangements,types:[]}});
      }
      const saved:string[]=[],errors:string[]=pushDenied?['Browser notifications were not enabled. Your email choice can still be saved.']:[];
      if(email!==status.email.enabled||email&&mode!==status.email.mode){try{await api('/api/digest-subscription',{enabled:email,mode});saved.push('Email preferences saved.');status.email.enabled=email;status.email.mode=mode;}catch(e){errors.push((e as Error).message)}}
      try{
        if(push&&!pushDenied){
          const registration=await navigator.serviceWorker.register('/sw.js',{scope:'/'});await navigator.serviceWorker.ready;
          let subscription=await registration.pushManager.getSubscription();
          if(!subscription){const key=Uint8Array.from(atob(status.push.publicKey!.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});newlyCreated=subscription;}
          await api('/api/push-subscription',{subscription:subscription.toJSON(),mode});status.push.enabled=true;status.push.mode=mode;newlyCreated=null;saved.push('Browser notifications enabled.');
        }else if(!push&&status.push.enabled){await api('/api/push-subscription',undefined,'DELETE');const registration=await navigator.serviceWorker?.getRegistration('/');await (await registration?.pushManager.getSubscription())?.unsubscribe();status.push.enabled=false;saved.push('Browser notifications disabled.');}
      }catch(e){await newlyCreated?.unsubscribe().catch(()=>{});errors.push((e as Error).message)}
      setStatus({...status});
      if(errors.length){setMessage([...saved,...errors].join(' '));return;}
      await api('/api/notification-preferences',{reviewed:true});setMessage('Preferences saved. Your daily summary follows the 8 AM IST refresh, only when new jobs qualify.');
      if(onboarding)setOpen(false);
      window.dispatchEvent(new Event('frontlane-notification-settings'));
    }catch(e){setMessage((e as Error).message)}finally{setBusy(false)}
  }
  const content=<div className="notification-options">
    <p className="muted">One daily summary after 8 AM IST, only when new jobs are available. Both choices are optional.</p>
    <label className="notification-choice"><Checkbox checked={email} disabled={busy||!status||!status.email.available&&!email} onCheckedChange={v=>setEmail(v===true)}/><span><strong><Mail size={17}/>Email me new jobs</strong><small>Sent to your verified sign-in email. Unsubscribe any time.</small></span></label>
    {status&&!status.email.available&&<p className="muted">Email delivery is being configured. Your current subscription is preserved.</p>}
    <label className="notification-choice"><Checkbox checked={push} disabled={busy||!status||(!supported||blocked||!status.push.available)&&!push} onCheckedChange={v=>setPush(v===true)}/><span><strong><Bell size={17}/>Notify me in this browser</strong><small>Requires browser permission. Manage each device separately.</small></span></label>
    {!supported?<p className="muted">Push is unavailable in this browser. On iPhone or iPad, add FrontlaneJobs to your Home Screen and open it there.</p>:blocked?<p className="muted">Notifications are blocked. You can allow them in your browser’s site settings.</p>:status&&!status.push.available?<p className="muted">Browser push is being configured.</p>:null}
    <label className="filter-control">Which jobs?<NativeSelect value={mode} disabled={busy} onChange={e=>setMode(e.target.value as 'matching'|'all')}><NativeSelectOption value="matching">Jobs matching my preferences</NativeSelectOption><NativeSelectOption value="all">All newly added jobs</NativeSelectOption></NativeSelect></label>
    {status&&!status.hasPreferences&&(email||push)&&mode==='matching'&&<fieldset className="notification-quick-setup"><legend>Set up your matches</legend><label>Skills, separated by commas<Input placeholder="React, TypeScript, Next.js" value={skills} maxLength={1200} disabled={busy} onChange={e=>setSkills(e.target.value)}/></label><div className="preference-options">{['Remote','Hybrid','Onsite'].map(item=><label key={item}><Checkbox disabled={busy} checked={arrangements.includes(item)} onCheckedChange={v=>setArrangements(v===true?[...arrangements,item]:arrangements.filter(x=>x!==item))}/>{item}</label>)}</div><small>You can refine these preferences in your account.</small></fieldset>}
    {message&&<p role="status" className="notice">{message}</p>}
    <div className="button-row"><Button disabled={busy||!status} onClick={save}>{busy?'Saving…':'Save preferences'}</Button>{onboarding&&<Button variant="ghost" disabled={busy} onClick={dismiss}>Maybe later</Button>}</div>
  </div>;
  if(onboarding)return <Dialog open={open} onOpenChange={value=>{if(!value)void dismiss();}}><DialogContent className="notification-dialog" showCloseButton={!busy}><DialogHeader><div className="eyebrow">YOUR NEXT OPPORTUNITY</div><DialogTitle>Stay in the loop.</DialogTitle><DialogDescription>Choose how you hear about new frontend jobs.</DialogDescription></DialogHeader>{content}</DialogContent></Dialog>;
  return <section className="profile-card" id="email"><div className="profile-card-heading"><span className="feature-icon"><Bell/></span><div><h2>New jobs, your way</h2><p>Daily email and browser notifications.</p></div></div>{content}</section>;
}
