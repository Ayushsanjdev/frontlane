import {recentFunding} from '@frontlanejobs/database/companies';
import {exploreCollections} from '@frontlanejobs/core/explore';
import {getUser} from '@/lib/session';
import {jobCollection} from '@/lib/jobs';
import {CompanyLogo} from './company-logo';
import Board from '@/app/jobs/board';
import {ArrowUpRight} from 'lucide-react';

type Company={id:string;name:string;description:string;careersUrl:string;evidenceUrl:string;groups:string[];funding:{announced:string;sourceUrl:string;round?:string;amount?:string}[]};
export default async function CatalogCompany({company,search}:{company:Company;search:URLSearchParams}){
  for(const key of ['companyGroup','recentlyFunded','freshers'])search.delete(key);
  if(search.get('collection')==='remote'){search.delete('mode');search.delete('city')}
  search.set('companyId',company.id);const initialParameters=search.toString();search.set('limit','12');
  const [collection,user]=await Promise.all([jobCollection(search),getUser()]);
  const funding=recentFunding(company);
  return <>
    <section className="wrap catalog-profile"><a className="quiet-link" href="/companies">← All companies</a><div className="catalog-profile-heading"><CompanyLogo company={company.name}/><div><h1>{company.name}</h1><p>{company.description}</p></div><a className="quiet-link" href={company.careersUrl} target="_blank" rel="noopener noreferrer">Official careers <ArrowUpRight size={17}/></a></div>
      <div className="catalog-memberships">{company.groups.map(group=><a href={'/explore/'+group} key={group}>{exploreCollections.find(c=>c.slug===group)?.title}</a>)}</div>
      {funding&&<p className="catalog-funding">{funding.round||'Funding announced'} · {funding.amount} · <time dateTime={funding.announced}>{funding.announced}</time> · <a href={funding.sourceUrl} target="_blank" rel="noopener noreferrer">Funding announcement <ArrowUpRight size={13}/></a></p>}
      <p className="muted">Company context: <a href={company.evidenceUrl} target="_blank" rel="noopener noreferrer">official company source</a>. Independent job discovery; no employer partnership implied.</p>
      {!collection.total&&<p className="catalog-empty">{collection.warning?'No curated roles match this search.':'No current roles match this search.'} <a href={company.careersUrl} target="_blank" rel="noopener noreferrer">Check official careers for additional opportunities.</a></p>}
    </section>
    <Board context={{slug:'company:'+company.id,title:'Opportunities at '+company.name,description:'Frontend roles in India and remote opportunities open to applicants in India.',filters:{companyId:company.id}}} remoteOnly={search.get('collection')==='remote'} signedIn={!!user} initialCollection={collection} initialType={search.get('type')||'All'} initialParameters={initialParameters}/>
  </>;
}
