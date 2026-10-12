import {getUser} from '@/lib/session';
import {jobCollection} from '@/lib/jobs';
import Board from './board';

export default async function Page({searchParams}:{searchParams:Promise<{type?:string|string[]}>}){
  const params=await searchParams;
  const type=typeof params.type==='string'?params.type:'All';
  const [user,collection]=await Promise.all([getUser(),jobCollection(new URLSearchParams({type,limit:'12'}))]);
  return <Board signedIn={!!user} initialCollection={collection} initialType={type}/>;
}
