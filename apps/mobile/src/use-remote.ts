import {useCallback,useRef,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {latestRequest} from './operations.mjs';
import {useApp} from './providers';
export function useRemote<T>(path:string|null){
  const {request,user}=useApp();
  const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0);
  const guard=useRef(latestRequest());
  useFocusEffect(useCallback(()=>{
    if(!path){setData(null);setLoading(false);return}
    const operation=guard.current.begin();setLoading(true);setError('');setData(null);
    request<T>(path,{signal:operation.signal}).then(value=>{if(operation.current())setData(value)}).catch(cause=>{if(operation.current()&&cause.name!=='AbortError')setError(cause.message)}).finally(()=>{if(operation.current())setLoading(false)});
    return ()=>guard.current.cancel();
  },[path,request,user?.userId,revision]));
  return {data,error,loading,refresh:()=>setRevision(value=>value+1)};
}
