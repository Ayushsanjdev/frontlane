import {useState} from 'react';
import {Linking,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import type {Job,Application} from '@frontlanejobs/contracts';
import {AuthGate,Button,Card,Loading,Notice,Screen,Txt,layout} from '../../src/ui';
import {useRemote} from '../../src/use-remote';
import {useApp} from '../../src/providers';
export default function JobDetail(){
  const {id}=useLocalSearchParams<{id:string}>();
  const {user,request}=useApp();const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[gate,setGate]=useState(false);
  const detail=useRemote<{job:Job}>('/api/jobs?id='+encodeURIComponent(id));const job=detail.data?.job;
  const tracker=useRemote<Application[]>(user?'/api/tracker':null);
  const saved=tracker.data?.find(item=>item.jobId===job?.id);
  async function save(){
    if(!job||busy)return;
    if(!user){setGate(true);return}
    if(tracker.loading||!tracker.data||tracker.error){setNotice('Load your tracker before saving to protect existing application notes.');return}
    if(saved){router.push({pathname:'/applications/[id]',params:{id:saved.id}});return}
    setBusy(true);setNotice('');
    try{await request('/api/tracker',{method:'POST',body:{action:'save',job}});setNotice('Saved to your private tracker.');tracker.refresh()}
    catch(error){setNotice(error instanceof Error?error.message:'Could not save the role. Try again.')}
    finally{setBusy(false)}
  }
  return <Screen>{detail.loading&&!job?<Loading/>:null}<Notice message={detail.error} error/>{!!detail.error&&<Button title="Retry opportunity" onPress={detail.refresh} secondary/>}{job&&<>
    <Txt tone="label">{job.company} · {job.type}</Txt><Txt tone="title">{job.title}</Txt><Txt tone="muted">{job.location} · {job.mode} · {job.experience}</Txt><Txt tone="heading">{job.salary}</Txt>
    <View style={layout.row}><Button title="Apply at source" icon="open-outline" onPress={()=>void Linking.openURL(job.url).catch(()=>setNotice('Could not open the application link. Try again.'))}/><Button title={saved?'Open in tracker':'Save to tracker'} icon="bookmark-outline" secondary busy={busy} disabled={!!user&&(tracker.loading||!tracker.data||!!tracker.error)} onPress={()=>void save()}/></View>
    <Notice message={notice||tracker.error}/>{!!tracker.error&&<Button title="Retry tracker" secondary onPress={tracker.refresh}/>}{gate&&!user&&<AuthGate message="Sign in to save this opportunity to your private tracker."/>}
    <Card><Txt tone="heading">The opportunity</Txt><Txt>{job.summary}</Txt><Txt tone="label">Skills</Txt><Txt tone="muted">{job.tags.join(', ')||'See employer requirements'}</Txt></Card>
    <Card><Txt tone="label">Eligibility</Txt><Txt>{job.eligibility}</Txt><Txt tone="label">Education</Txt><Txt>{job.degree}</Txt></Card>
    <Notice message={job.caveat}/><Txt tone="muted">Discovered: {job.discovered}{'\n'}{job.source==='community'?'Community posted':'Last checked'}: {job.checked.slice(0,10)||'Not verified'}{'\n'}Employer posted: {job.posted?.slice(0,10)||'Not verified'}{'\n'}Source: {job.source}</Txt>
    <Txt tone="muted">Opening an application does not mark it submitted.</Txt>
  </>}</Screen>;
}
