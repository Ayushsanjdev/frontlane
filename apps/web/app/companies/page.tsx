import {database} from '@frontlanejobs/database/client';
import {CompanyLogo} from '@/components/company-logo';
import {companyInfo,companyPath} from '@/lib/company-info';
export default async function Page(){
  let companies:{source:string;name:string;count:number}[]=[];let failed=false;
  try{companies=(await database().query("SELECT source,min(payload->>'company') AS name,count(*)::int AS count FROM jobs WHERE active=true AND source ~ '^(greenhouse|lever|smartrecruiters):' GROUP BY source ORDER BY name")).rows}catch{failed=true}
  return <section className="wrap workspace-page"><div className="eyebrow">MEET YOUR NEXT TEAM</div><h1>Explore companies<span>.</span></h1><p>Employer context and opportunities, with known facts up front.</p>{failed?<div className="empty-state"><h3>Companies could not be loaded.</h3><a href="/companies">Try again</a></div>:<div className="company-grid">{companies.map(company=><a key={company.source} href={companyPath(company.source)} className="company-tile"><CompanyLogo company={company.name}/><h2>{company.name}</h2><p>{companyInfo[company.source]?.industry||'Employer feed'}</p><strong>{company.count} selected opportunities →</strong></a>)}{!companies.length&&<p>No employer opportunities are currently selected. <a href="/jobs">Browse all roles</a></p>}</div>}</section>;
}
