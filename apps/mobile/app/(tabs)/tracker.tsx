import {useState} from 'react';
import {FlatList,Pressable,View} from 'react-native';
import {router} from 'expo-router';
import {stages,type Application} from '@frontlanejobs/contracts';
import {AuthGate,Button,Card,Choices,Field,Loading,Notice,Screen,Txt,layout} from '../../src/ui';
import {useRemote} from '../../src/use-remote';
import {useApp} from '../../src/providers';
export default function Tracker(){
  const {user}=useApp();const [stage,setStage]=useState('All'),[search,setSearch]=useState('');
  const remote=useRemote<Application[]>(user?'/api/tracker':null);
  if(!user)return <Screen><Txt tone="title">Every opportunity,{ '\n'}a little more organised.</Txt><AuthGate/></Screen>;
  const items=(remote.data||[]).filter(item=>(stage==='All'||item.stage===stage)&&(item.job.title+' '+item.job.company).toLowerCase().includes(search.toLowerCase()));
  return <Screen scroll={false}><FlatList data={items} keyExtractor={item=>item.id} contentContainerStyle={[layout.content,{gap:14}]} refreshing={remote.loading} onRefresh={remote.refresh} ListHeaderComponent={<View style={layout.stack}>
    <Txt tone="title">Your next move.</Txt><Txt tone="muted">{remote.data?.length||0} opportunities in your private workspace.</Txt>
    <Field label="Search saved roles" value={search} onChangeText={setSearch} placeholder="Role or company"/><Choices label="Stage" value={stage} options={['All',...stages]} onChange={setStage}/>
    <Notice message={remote.error} error/>{!!remote.error&&<Button title="Retry tracker" onPress={remote.refresh} secondary/>}
  </View>} renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.job.title} at ${item.job.company}`} onPress={()=>router.push({pathname:'/applications/[id]',params:{id:item.id}})}><Card><View style={layout.spread}><Txt tone="label" style={{flex:1}}>{item.job.company}</Txt><Txt tone="muted">{item.stage}</Txt></View><Txt tone="heading">{item.job.title}</Txt><Txt tone="muted">{item.job.location}</Txt>{!!item.followUp&&<Txt tone="muted">Follow up: {item.followUp}</Txt>}{!!item.notes&&<Txt numberOfLines={2}>{item.notes}</Txt>}</Card></Pressable>} ListEmptyComponent={remote.loading?<Loading/>:!remote.error?<Card><Txt tone="heading">Make room for your next role.</Txt><Txt tone="muted">{remote.data?.length?'Try another stage or search.':'Save opportunities from the job board to start your tracker.'}</Txt><Button title="Browse jobs" onPress={()=>router.navigate('/')} secondary/></Card>:null}/></Screen>;
}
