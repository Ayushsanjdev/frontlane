'use client';
import {useId,useState} from 'react';
import {Globe2,Info} from 'lucide-react';

export default function RemoteSwitch({checked,search,basePath}:{checked:boolean;search:string;basePath?:string}){
  const [help,setHelp]=useState(false),id=useId();
  function toggle(){
    const params=new URLSearchParams(search);
    for(const key of ['page','job','city','mode','collection','post'])params.delete(key);
    if(basePath&&!checked)params.set('collection','remote');
    const query=params.toString();
    location.assign((basePath||(checked?'/jobs':'/jobs/remote'))+(query?'?'+query:''));
  }
  return <div className="remote-toggle">
    <button type="button" role="switch" aria-checked={checked} aria-describedby={help?id:undefined} onClick={toggle} className="remote-switch"><Globe2 size={16}/><span>Remote only</span><span className="remote-switch-track" aria-hidden="true"><span/></span></button>
    <span className="remote-help" onMouseEnter={()=>setHelp(true)} onMouseLeave={()=>setHelp(false)}>
      <button type="button" aria-label="About remote jobs" aria-expanded={help} aria-describedby={help?id:undefined} onFocus={e=>{if(e.currentTarget.matches(':focus-visible'))setHelp(true)}} onBlur={()=>setHelp(false)} onClick={()=>setHelp(true)} onKeyDown={e=>{if(e.key==='Escape')setHelp(false)}}><Info size={16}/></button>
      {help&&<span role="tooltip" id={id}>Remote worldwide and India-eligible roles</span>}
    </span>
  </div>;
}
