import {redirect} from 'next/navigation';
import {getUser} from '@/lib/session';
import {jobCollection} from '@/lib/jobs';
import Board from './board';

export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams;
  const type=typeof params.type==='string'?params.type:'All';
  const query=new URLSearchParams();for(const [key,value] of Object.entries(params))for(const entry of Array.isArray(value)?value:value?[value]:[])query.append(key,entry);query.delete('limit');if(query.get('collection')==='remote')redirect('/jobs/remote?'+query.toString());const initialParameters=query.toString();query.set('limit','12');
  const [user,collection]=await Promise.all([getUser(),jobCollection(query)]);
  return <Board signedIn={!!user} initialCollection={collection} initialType={type} initialParameters={initialParameters}/>;
}
