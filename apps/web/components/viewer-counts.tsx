'use client';

import {useEffect,useState} from 'react';
import {Eye,Users} from 'lucide-react';
import {viewerHeartbeat} from '@/lib/viewer-heartbeat';

type Counts={total:number;current:number};

export function ViewerCounts(){
  const [counts,setCounts]=useState<Counts|null>(null);
  const [unavailable,setUnavailable]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    let pending=false;
    async function refresh(){
      if(document.visibilityState!=='visible'||pending)return;
      pending=true;
      try{
        const response=await viewerHeartbeat(controller.signal);
        if(!response.ok)throw Error('Unavailable');
        const next=await response.json();
        if(!Number.isSafeInteger(next.total)||!Number.isSafeInteger(next.current)||next.current<0||next.total<next.current)throw Error('Invalid counts');
        if(!controller.signal.aborted){setCounts(next);setUnavailable(false)}
      }catch{
        if(!controller.signal.aborted){setCounts(null);setUnavailable(true)}
      }finally{pending=false}
    }
    void refresh();
    const interval=window.setInterval(()=>void refresh(),30000);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange',refresh);
    };
  },[]);
  const format=(value:number|undefined)=>value===undefined?'—':value.toLocaleString('en-IN');
  return <div className="viewer-counts" aria-label="App viewers" aria-busy={!counts&&!unavailable}>
    <span title="Unique browsers since viewer tracking began"><Users size={15} aria-hidden="true"/><strong>{format(counts?.total)}</strong> total viewers</span>
    <span title="Browsers active within the last 90 seconds"><Eye size={15} aria-hidden="true"/><strong>{format(counts?.current)}</strong> currently viewing</span>
    {unavailable&&<small>Viewer counts unavailable</small>}
  </div>;
}
