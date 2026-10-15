import {SOURCES} from './sources.mjs';
import {REMOTE_SOURCES} from './remote-eligibility.mjs';
import {companies,recentFunding,resolveCompany} from '@frontlanejobs/database/companies';

export function summarizeFeedHealth(checks,params=new URLSearchParams()){
  const constrained=params.has('companyGroup')||params.has('companyId')||params.get('recentlyFunded')==='1';
  const selected=companies.filter(c=>(!params.get('companyGroup')||c.groups.includes(params.get('companyGroup')))&&(!params.get('companyId')||c.id===params.get('companyId'))&&(params.get('recentlyFunded')!=='1'||recentFunding(c)));
  const ids=new Set(selected.map(c=>c.id));
  const expected=new Set(SOURCES.filter(([provider,slug,company])=>!constrained||ids.has(resolveCompany({source:provider+':'+slug.toLowerCase(),company})?.id)).map(([p,s])=>p+':'+s.toLowerCase()));
  const explore=constrained||params.get('freshers')==='1';
  if(params.get('collection')==='remote'||explore)for(const source of REMOTE_SOURCES)expected.add(source);
  // Include previously checked/discovered boards where their curated identity is known.
  for(const check of checks)if(/^(greenhouse|lever|smartrecruiters|ashby|amazon):/.test(check.source)&&(!constrained||ids.has(resolveCompany({source:check.source})?.id)))expected.add(check.source);
  const rows=checks.filter(row=>expected.has(row.source));
  const latest=values=>values.filter(Boolean).map(value=>new Date(value).toISOString()).sort().at(-1)||null;
  return {configured:expected.size,healthy:rows.filter(r=>r.status==='ok').length,failed:rows.filter(r=>r.status==='failed').length,partial:rows.filter(r=>r.status==='partial').length,pending:expected.size-rows.length,
    lastSuccess:latest(rows.map(r=>r.last_success||r.status==='ok'&&r.checked_at)),lastAttempt:latest(rows.map(r=>r.checked_at))};
}
