import catalog from '../data/companies.json' with {type:'json'};

export const companies=catalog;
const names=new Map(companies.flatMap(company=>company.aliases.map(name=>[name.trim().toLowerCase(),company])));
const sources=new Map(companies.flatMap(company=>company.sources.map(source=>[source,company])));

/** Exact, curated aliases only. A known employer feed takes precedence over display names. */
export function resolveCompany(job){
  return sources.get(job.source)||names.get(String(job.company||'').trim().toLowerCase())||null;
}

export function fundingWindow(now=new Date()){
  const end=now.toISOString().slice(0,10);
  const year=now.getUTCFullYear()-1,month=now.getUTCMonth();
  const day=Math.min(now.getUTCDate(),new Date(Date.UTC(year,month+1,0)).getUTCDate());
  return {start:new Date(Date.UTC(year,month,day)).toISOString().slice(0,10),end};
}

export function recentFunding(company,now=new Date()){
  const {start,end}=fundingWindow(now);
  return (company.funding||[]).filter(item=>item.announced>=start&&item.announced<=end)
    .sort((a,b)=>b.announced.localeCompare(a.announced))[0]||null;
}
