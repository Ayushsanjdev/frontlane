import {recentFunding} from '@frontlanejobs/database/companies';
import {CompanyLogo} from '@/components/company-logo';
import {ArrowUpRight} from 'lucide-react';

type Company={id:string;name:string;description:string;careersUrl:string;evidenceUrl:string;groups:string[];funding:{announced:string;sourceUrl:string;round?:string;amount?:string}[]};
export default function ExploreCompanies({companies,counts,funded=false,fallback=false}:{companies:Company[];counts:Record<string,number>;funded?:boolean;fallback?:boolean}){
  return <div className="explore-company-grid">{companies.map(company=>{
    const funding=funded?recentFunding(company):null,count=counts[company.id]||0;
    return <article className="explore-company" key={company.id}>
      <div className="explore-company-heading"><CompanyLogo company={company.name}/><div><h3><a href={'/companies/'+company.id}>{company.name}</a></h3><p>{company.description}</p></div></div>
      {funding&&<div className="funding-fact"><time dateTime={funding.announced}>{new Date(funding.announced+'T00:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}</time><strong>{funding.round||'Funding announced'}</strong>{funding.amount&&<span>{funding.amount}</span>}<a href={funding.sourceUrl} target="_blank" rel="noopener noreferrer">Read announcement <ArrowUpRight size={14}/></a></div>}
      <div className="explore-company-actions"><a href={'/companies/'+company.id}>{count?`${count} ${fallback?'curated':'current'} ${count===1?'opening':'openings'}`:fallback?'No curated openings':'No current openings'}</a><a href={company.careersUrl} target="_blank" rel="noopener noreferrer">Official careers <ArrowUpRight size={14}/></a></div>
    </article>;
  })}</div>;
}
