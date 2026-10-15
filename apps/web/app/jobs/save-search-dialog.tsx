'use client';
import {Input} from '@/components/ui/input';
import {useState} from 'react';
import {Bookmark} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export default function SaveSearchDialog({signedIn,search,onSaved,basePath='/jobs'}:{basePath?:string;signedIn:boolean;search:string;onSaved:()=>void}){
  const [open,setOpen]=useState(false),[name,setName]=useState('Frontend opportunities'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function save(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');const criteria=new URLSearchParams(search);for(const key of ['job','page','view','limit'])criteria.delete(key);
    try{const response=await fetch('/api/saved-searches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,criteria:criteria.toString(),enabled:true})});const data=await response.json();if(!response.ok)throw Error(data.error);setOpen(false);onSaved()}catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  if(!signedIn)return <Button variant="ghost" size="sm" className="quiet-link" onClick={()=>{location.href='/signin?returnTo='+encodeURIComponent(basePath+'?'+search)}}><Bookmark size={15}/>Save search</Button>;
  return <Dialog open={open} onOpenChange={value=>{setOpen(value);setError('')}}><DialogTrigger asChild><Button variant="ghost" size="sm" className="quiet-link"><Bookmark size={15}/>Save search</Button></DialogTrigger><DialogContent><DialogTitle>Save this search</DialogTitle><DialogDescription>Get private in-app alerts for new roles matching these filters. Daily email preferences are managed separately.</DialogDescription><form onSubmit={save}><label>Search name<Input required autoFocus maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>{error&&<p className="form-error" role="alert">{error}</p>}<Button disabled={busy}>{busy?'Saving…':'Save search & enable alerts'}</Button></form></DialogContent></Dialog>;
}
