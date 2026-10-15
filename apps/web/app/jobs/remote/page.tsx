import {getUser} from '@/lib/session';
import {jobCollection} from '@/lib/jobs';
import Board from '../board';

export const metadata={title:'Remote frontend jobs | FrontlaneJobs',description:'Worldwide and India-eligible remote frontend roles from employer feeds and free public job boards.'};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const params=await searchParams;
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(params))for(const entry of Array.isArray(value)?value:value?[value]:[])query.append(key,entry);
  query.delete('limit');query.delete('mode');query.delete('city');query.set('collection','remote');
  const initialParameters=query.toString();query.set('limit','12');
  const [user,collection]=await Promise.all([getUser(),jobCollection(query)]);
  return <Board key="remote" remoteOnly signedIn={!!user} initialCollection={collection} initialType={query.get('type')||'All'} initialParameters={initialParameters}/>;
}
