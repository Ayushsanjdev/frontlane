import {database} from '@frontlanejobs/database/client';
import {companies,resolveCompany} from '@frontlanejobs/database/companies';
import {CompanyLogo} from '@/components/company-logo';
import {companyInfo,companyPath} from '@/lib/company-info';
import {companyCounts} from '@/lib/explore';
import ExploreCompanies from '@/components/explore-companies';
export const metadata={title:'All companies | FrontlaneJobs',description:'Explore company profiles, official careers pages and frontend opportunities.'};
export default async function Page(){
  const summary=await companyCounts(new URLSearchParams('companyGroup='));
  let otherCompanies:{source:string;name:string;count:number}[]=[];
  try{otherCompanies=(await database().query("SELECT source,min(payload->>'company') AS name,count(*)::int AS count FROM jobs WHERE active=true AND source ~ '^(greenhouse|lever|smartrecruiters|ashby|amazon):' GROUP BY source ORDER BY name")).rows.filter((row:{source:string;name:string})=>!resolveCompany({source:row.source,company:row.name}))}catch{}
  return <section className="wrap workspace-page"><a className="quiet-link" href="/explore">← Explore collections</a><h1>Explore companies<span>.</span></h1><p>Employer context, current opportunities and a direct route to official careers.</p>{summary.fallback&&<p className="muted" role="status">Live counts are unavailable. Showing curated openings.</p>}<ExploreCompanies companies={[...companies].sort((a,b)=>a.name.localeCompare(b.name))} counts={summary.counts} fallback={summary.fallback}/>{!!otherCompanies.length&&<><h2 className="workspace-section-title">More employers with current openings</h2><div className="company-grid">{otherCompanies.map(company=><a key={company.source} href={companyPath(company.source,company.name)} className="company-tile"><CompanyLogo company={company.name}/><h2>{company.name}</h2><p>{companyInfo[company.source]?.industry||'Employer feed'}</p><strong>{company.count} selected opportunities →</strong></a>)}</div></>}</section>;
}
