import {Pressable,View} from 'react-native';
import {router} from 'expo-router';
import type {Job} from '@frontlanejobs/contracts';
import {Card,Txt,layout} from './ui';
import {useApp} from './providers';
export function JobCard({job}:{job:Job}){
  const {colors}=useApp();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${job.title} at ${job.company}. View role`} onPress={()=>router.push({pathname:'/jobs/[id]',params:{id:job.id}})}><Card>
    <View style={layout.spread}><Txt tone="label" style={{color:colors.primary,flex:1}}>{job.company}</Txt><Txt tone="muted">{job.mode}</Txt></View>
    <Txt tone="heading">{job.title}</Txt>
    <Txt tone="muted">{job.location} · {job.type}</Txt>
    <View style={[layout.row,{gap:6}]}>{job.tags.slice(0,5).map(tag=><View key={tag} style={{backgroundColor:colors.soft,paddingHorizontal:9,paddingVertical:5,borderRadius:6}}><Txt tone="muted" style={{color:colors.primary,fontSize:12}}>{tag}</Txt></View>)}</View>
    <Txt tone="label">{job.salary}</Txt>
    <Txt tone="muted" style={{fontSize:12}}>{job.source==='community'?'Community listing':!job.checked||Date.now()-new Date(job.checked).getTime()>7*86400000?'Recheck availability':'Checked '+new Date(job.checked).toLocaleDateString('en-IN')}</Txt>
  </Card></Pressable>;
}
