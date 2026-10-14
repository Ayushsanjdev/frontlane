import {useEffect,useState} from 'react';
import {FlatList,View} from 'react-native';
import {router} from 'expo-router';
import type {JobCollection} from '@frontlanejobs/contracts';
import {Button,Choices,Field,Loading,Notice,Screen,Txt,layout} from '../../src/ui';
import {jobQuery} from '../../src/operations.mjs';
import {useRemote} from '../../src/use-remote';
import {useApp} from '../../src/providers';
import {JobCard} from '../../src/job-card';
const initial={q:'',type:'All',mode:'All',stack:'All',sort:'recommended',page:1};
export default function Jobs(){
  const [filters,setFilters]=useState(initial),[search,setSearch]=useState(''),[expanded,setExpanded]=useState(false);
  const {colors}=useApp();
  useEffect(()=>{const timer=setTimeout(()=>setFilters(current=>({...current,q:search,page:1})),250);return ()=>clearTimeout(timer)},[search]);
  const feed=useRemote<JobCollection>('/api/jobs?'+jobQuery(filters));
  const change=(key:keyof typeof initial,value:string)=>setFilters(current=>({...current,[key]:value,page:1}));
  const reset=()=>{setSearch('');setFilters(initial)};
  const header=<View style={layout.stack}>
    <Txt tone="title">Find your lane.</Txt><Txt tone="muted">Frontend opportunities for India. The details that matter, up front.</Txt>
    <Field label="Search opportunities" value={search} onChangeText={setSearch} placeholder="Role, company, technology or city" returnKeyType="search"/>
    <Choices label="Employment type" value={filters.type} options={['All','Full-time','Freelance','Part-time','Contract']} onChange={value=>change('type',value)}/>
    <View style={layout.row}><Button title={expanded?'Hide filters':'Refine search'} icon="options-outline" secondary onPress={()=>setExpanded(value=>!value)}/><Button title="Add a job" icon="add" onPress={()=>router.push('/publish')}/></View>
    {expanded&&<><Choices label="Work arrangement" value={filters.mode} options={['All','Remote','Hybrid','Onsite']} onChange={value=>change('mode',value)}/><Choices label="Your stack" value={filters.stack} options={['All','React','Next.js','TypeScript','React Native','Tailwind','JavaScript']} onChange={value=>change('stack',value)}/><Choices label="Sort" value={filters.sort} options={['recommended','newest','remote']} labels={{recommended:'Recommended',newest:'Recently discovered',remote:'Remote first'}} onChange={value=>change('sort',value)}/><Button title="Reset filters" secondary onPress={reset}/></>}
    <View style={layout.spread}><Txt tone="label">{feed.data?`${feed.data.total} opportunities`:'Opportunities'}</Txt>{feed.loading&&feed.data&&<Txt tone="muted">Updating…</Txt>}</View>
    <Notice message={feed.error||feed.data?.warning||''} error={!!feed.error}/>{!!feed.error&&<Button title="Retry feed" secondary onPress={feed.refresh}/>}
  </View>;
  return <Screen scroll={false}><FlatList data={feed.data?.jobs||[]} keyExtractor={job=>job.id} renderItem={({item})=><JobCard job={item}/>} contentContainerStyle={[layout.content,{gap:14}]} ListHeaderComponent={header} keyboardShouldPersistTaps="handled" refreshing={feed.loading} onRefresh={feed.refresh} ListEmptyComponent={feed.loading?<Loading/>:!feed.error?<View style={{paddingVertical:25,gap:12}}><Txt tone="heading">No matches in this lane yet.</Txt><Txt tone="muted">Try fewer filters or a different technology.</Txt><Button title="Clear filters" secondary onPress={reset}/></View>:null} ListFooterComponent={<View style={layout.stack}>
    {(feed.data?.total||0)>12&&<View style={layout.spread}><Button title="Previous" secondary disabled={filters.page===1||feed.loading} onPress={()=>setFilters(current=>({...current,page:current.page-1}))}/><Txt tone="muted">{filters.page} / {Math.ceil((feed.data?.total||0)/12)}</Txt><Button title="Next" secondary disabled={filters.page*12>=(feed.data?.total||0)||feed.loading} onPress={()=>setFilters(current=>({...current,page:current.page+1}))}/></View>}
    <Txt tone="muted" style={{fontSize:12,color:colors.muted}}>{feed.data?.lastSync?'Feeds last checked '+new Date(feed.data.lastSync).toLocaleString('en-IN')+'. ':''}Discovery dates are not employer posting dates. Confirm eligibility before applying.</Txt>
  </View>}/></Screen>;
}
