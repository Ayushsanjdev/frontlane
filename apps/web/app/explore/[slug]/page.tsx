import {notFound} from 'next/navigation';
import {collectionCompanies,exploreCollections,exploreParameters} from '@frontlanejobs/core/explore';
import {jobCollection} from '@/lib/jobs';
import {companyCounts,searchParameters} from '@/lib/explore';
import {getUser} from '@/lib/session';
import ExploreCompanies from '@/components/explore-companies';
import Board from '@/app/jobs/board';

type Props={params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>};
export async function generateMetadata({params}:Props){
  const {slug}=await params;const item=exploreCollections.find(c=>c.slug===slug);
  return {title:item?`${item.title} frontend jobs | FrontlaneJobs`:'Collection not found',description:item?.description};
}
export default async function Page({params,searchParams}:Props){
  const {slug}=await params,collection=exploreCollections.find(c=>c.slug===slug);
  if(!collection)notFound();
  const query=exploreParameters(slug,searchParameters(await searchParams))!;
  const initialParameters=query.toString();query.set('limit','12');
  const countParams=exploreParameters(slug)!;if(query.get('collection')==='remote')countParams.set('collection','remote');
  const [jobs,user,summary]=await Promise.all([jobCollection(query),getUser(),slug==='freshers'?Promise.resolve(null):companyCounts(countParams)]);
  const members=collectionCompanies(countParams);
  const overview=summary?<details className="collection-company-details" open={slug==='recently-funded'}><summary>{slug==='recently-funded'?'Funding announcements':`${members.length} companies and official careers`}</summary><p className="muted">{slug==='recently-funded'?'Announcements from the past 12 calendar months. Funding does not imply hiring.':'Opening counts cover this collection before your search refinements.'}</p>{summary.fallback&&<p className="muted" role="status">Live counts are unavailable. Showing curated openings.</p>}<ExploreCompanies companies={members} counts={summary.counts} funded={slug==='recently-funded'} fallback={summary.fallback}/></details>:undefined;
  return <Board key={slug+':'+query.get('collection')} overview={overview} context={{slug,title:collection.title,description:collection.description,filters:Object.fromEntries(Object.entries(collection.filters).filter((entry):entry is [string,string]=>typeof entry[1]==='string'))}} remoteOnly={query.get('collection')==='remote'} signedIn={!!user} initialCollection={jobs} initialType={query.get('type')||'All'} initialParameters={initialParameters}/>;
}
