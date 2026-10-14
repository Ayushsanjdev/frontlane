import {useEffect,useRef,useState} from 'react';
import {Linking} from 'react-native';
import type {Profile} from '@frontlanejobs/contracts';
import {AuthGate,Button,Card,Choices,Field,Loading,Notice,Screen,Txt} from '../../src/ui';
import {apiOrigin,useApp,type Appearance} from '../../src/providers';
import {useRemote} from '../../src/use-remote';
const fields=[['name','Name'],['location','Location'],['skills','Skills'],['experience','Experience'],['salary','Salary expectations'],['availability','Availability'],['portfolio','Portfolio link'],['resumeUrl','Resume link'],['preference','Work preferences']] as const;
export default function Account(){
  const {user,appearance,setAppearance,request,signOut,authBusy,authError}=useApp();
  const remote=useRemote<Partial<Profile>>(user?'/api/profile':null);const [form,setForm]=useState<Partial<Profile>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');const loaded=useRef(false);
  useEffect(()=>{if(!loaded.current&&remote.data){setForm(remote.data);loaded.current=true}},[remote.data]);
  async function save(){
    if(busy||!loaded.current)return;setBusy(true);setError('');setNotice('');
    try{await request('/api/profile',{method:'POST',body:form});setNotice('Profile saved.')}
    catch(cause){setError(cause instanceof Error?cause.message:'Could not save your profile. Try again.')}
    finally{setBusy(false)}
  }
  const open=(path:string)=>void Linking.openURL(apiOrigin+path).catch(()=>setError('Could not open the page. Try again.'));
  return <Screen><Txt tone="title">Your career,{ '\n'}on your terms.</Txt>{!user?<AuthGate/>:<>
    <Card><Txt tone="heading">{user.name}</Txt><Txt tone="muted">{user.email}</Txt><Txt tone="muted">Your profile and tracker are shared with your account on the website.</Txt></Card>
    {remote.loading&&!loaded.current&&<Loading/>}<Notice message={remote.error||error} error/><Notice message={notice}/>{!!remote.error&&<Button title="Retry profile" onPress={remote.refresh} secondary/>}
    {loaded.current&&<Card><Txt tone="heading">Your profile</Txt>{fields.map(([key,label])=><Field key={key} label={label} value={form[key]||''} onChangeText={value=>setForm(current=>({...current,[key]:value}))} maxLength={1000} editable={!busy} autoCapitalize={key==='portfolio'||key==='resumeUrl'?'none':'sentences'} keyboardType={key==='portfolio'||key==='resumeUrl'?'url':'default'}/>)}<Button title="Save profile" onPress={()=>void save()} busy={busy}/></Card>}
    <Notice message={authError} error/><Button title="Sign out" secondary busy={authBusy} onPress={()=>void signOut()}/>
  </>}<Card><Choices label="Appearance" value={appearance} options={['system','light','dark']} labels={{system:'System',light:'Light',dark:'Dark'}} onChange={value=>setAppearance(value as Appearance)}/><Button title="About FrontlaneJobs" secondary icon="open-outline" onPress={()=>open('/about')}/><Button title="Sources and refresh status" secondary icon="open-outline" onPress={()=>open('/updates')}/></Card></Screen>;
}
