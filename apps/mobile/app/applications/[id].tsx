import {useEffect,useRef,useState} from 'react';
import {Alert} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {stages,type Application,type Stage} from '@frontlanejobs/contracts';
import {AuthGate,Button,Choices,Field,Loading,Notice,Screen,Txt} from '../../src/ui';
import {useRemote} from '../../src/use-remote';
import {useApp} from '../../src/providers';
export default function ApplicationDetail(){
  const {id}=useLocalSearchParams<{id:string}>();const {user,request}=useApp();
  const remote=useRemote<Application[]>(user?'/api/tracker':null);const [form,setForm]=useState<Application|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');const loaded=useRef(false);
  useEffect(()=>{if(!loaded.current&&remote.data){setForm(remote.data.find(item=>item.id===id)||null);loaded.current=true}},[remote.data,id]);
  const update=(key:keyof Application,value:string)=>setForm(current=>current?{...current,[key]:value}:current);
  async function save(){
    if(!form||busy)return;
    if(['Applied','Interview','Offer'].includes(form.stage)&&(!form.appliedAt||!form.evidence.trim())){setError('Add the application date and a receipt or your confirmation.');return}
    setBusy(true);setError('');setNotice('');
    try{const item=await request<Application>('/api/tracker',{method:'POST',body:form});setForm(item);setNotice('Application saved.')}
    catch(cause){setError(cause instanceof Error?cause.message:'Could not save. Try again.')}
    finally{setBusy(false)}
  }
  async function remove(){
    if(!form||busy)return;setBusy(true);setError('');
    try{await request('/api/tracker',{method:'DELETE',body:{id:form.id}});router.back()}
    catch(cause){setError(cause instanceof Error?cause.message:'Could not remove. Try again.')}
    finally{setBusy(false)}
  }
  if(!user)return <Screen><AuthGate/></Screen>;
  return <Screen>{remote.loading&&!form&&<Loading/>}<Notice message={remote.error||error} error/><Notice message={notice}/>{!!remote.error&&<Button title="Retry application" secondary onPress={remote.refresh}/>}{form?<>
    <Txt tone="label">{form.job.company}</Txt><Txt tone="title">{form.job.title}</Txt>
    <Choices label="Application stage" value={form.stage} options={stages} onChange={value=>{if(!busy)update('stage',value as Stage)}}/>
    <Field label="Notes" value={form.notes} onChangeText={value=>update('notes',value)} multiline maxLength={6000} editable={!busy}/>
    <Field label="Application answers" value={form.answers} onChangeText={value=>update('answers',value)} multiline maxLength={6000} editable={!busy}/>
    <Field label="Application date (YYYY-MM-DD)" value={form.appliedAt} onChangeText={value=>update('appliedAt',value)} maxLength={10} placeholder="2026-10-14" editable={!busy}/>
    <Field label="Follow-up date (YYYY-MM-DD)" value={form.followUp} onChangeText={value=>update('followUp',value)} maxLength={10} placeholder="2026-10-21" editable={!busy}/>
    <Field label="Receipt or application confirmation" value={form.evidence} onChangeText={value=>update('evidence',value)} multiline maxLength={1000} editable={!busy}/>
    <Txt tone="muted">Add a date and evidence before moving to Applied, Interview, or Offer.</Txt>
    <Button title="Save application" onPress={()=>void save()} busy={busy}/><Button title="Remove from tracker" secondary disabled={busy} onPress={()=>Alert.alert('Remove this application?','Your notes and answers for this role will be removed.',[{text:'Keep',style:'cancel'},{text:'Remove',style:'destructive',onPress:()=>void remove()}])}/>
  </>:!remote.loading&&!remote.error&&<Txt>This application is no longer in your tracker.</Txt>}</Screen>;
}
