import {companies,resolveCompany,recentFunding} from '@frontlanejobs/database/companies';

export const exploreCollections=[
  {slug:'faang',title:'FAANG',description:'Meta, Amazon, Apple, Netflix and Google. Explore their frontend opportunities and official careers pages.',filters:{companyGroup:'faang'}},
  {slug:'big-tech',title:'Big Tech',description:'Global technology platforms, including FAANG, Microsoft, NVIDIA and Adobe.',filters:{companyGroup:'big-tech'}},
  {slug:'established-product',title:'Established product companies',description:'Teams building and operating their own software products at scale.',filters:{companyGroup:'established-product'}},
  {slug:'growth-startups',title:'Growth startups',description:'Privately backed product companies building their next stage of growth.',filters:{companyGroup:'growth-startups'}},
  {slug:'services',title:'Services companies',description:'Digital engineering, technology consulting and client delivery teams.',filters:{companyGroup:'services'}},
  {slug:'recently-funded',title:'Recently funded',description:'Verified funding announcements from the past 12 months, with sources and current frontend openings.',filters:{recentlyFunded:'1'}},
  {slug:'freshers',title:'Fresher Special',description:'Internships, graduate opportunities and roles requiring 0–1 years. Only explicit early-career requirements make the cut.',filters:{freshers:'1'}},
];
const groups=new Set(['faang','big-tech','established-product','growth-startups','services']);
// These portable expressions are shared by JavaScript and PostgreSQL.
const years='(^|[^0-9])([0-9]{1,2})([ \\t]*[-–][ \\t]*[0-9]{1,2})?[+]?[ \\t]+(years?|yrs?)';
const higherWords='(^|[^a-z])(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[ +\\t-]+(years?|yrs?)([^a-z]|$)';
const senior='(^|[^a-z])(senior|sr[.]?|lead|staff|principal|manager|head|director)([^a-z]|$)';
const entry='(^|[^a-z])(intern(ship)?|graduate|new[ -]grad|freshers?|entry[ -]level)([^a-z]|$)';
const noExperience='(no|zero)[ \\t]+(prior[ \\t]+|professional[ \\t]+)?experience[ \\t]+(is[ \\t]+)?(required|necessary|needed)';
const excludedEntry='(^|[^a-z])(no[ \\t]+freshers?|freshers?[ \\t]+(are[ \\t]+)?not[ \\t]+(eligible|accepted)|not[ \\t]+(open[ \\t]+|suitable[ \\t]+)?(to[ \\t]+|for[ \\t]+)?freshers?)([^a-z]|$)';
const india='(^|[^a-z])(india|bengaluru|bangalore|hyderabad|pune|mumbai|chennai|gurugram|gurgaon|noida|delhi)([^a-z]|$)';
const frontend='front[ -]?end|react|angular|vue|(^|[^a-z])ui([^a-z]|$)|web[ ]+(engineer|developer)';
const re=pattern=>new RegExp(pattern,'i');
const text=job=>[job.experience,job.summary,job.enrichment?.description].filter(Boolean).join(' ');

export function isFresher(job){
  if(re(senior).test(job.title)||['Senior','Lead','Staff','Mid'].includes(job.enrichment?.seniority))return false;
  const value=text(job),requirements=[...value.matchAll(new RegExp(years,'gi'))].map(match=>Number(match[2]));
  if(job.enrichment?.yearsMin!==undefined)requirements.push(job.enrichment.yearsMin);
  if(requirements.some(value=>value>1)||re(higherWords).test(value)||re(excludedEntry).test(value+' '+job.title))return false;
  return requirements.length>0||re(entry).test(job.title)||re(entry).test(job.experience||'')||['Internship','Graduate','Entry-level'].includes(job.enrichment?.careerStage)||re(noExperience).test(value);
}

export function isExploreSearch(params){return ['companyGroup','companyId','recentlyFunded','freshers'].some(key=>params.has(key))}
export function matchesExplore(job,params,now=new Date()){
  if(!isExploreSearch(params))return true;
  if(!re(frontend).test(job.title))return false;
  if(!re(india).test(job.location)&&!(job.remote&&['worldwide','india'].includes(job.remote.scope)&&(job.enrichment?.arrangement||job.mode)==='Remote'))return false;
  const company=resolveCompany(job),group=params.get('companyGroup');
  return (!group||groups.has(group)&&company?.groups.includes(group))&&
    (!params.get('companyId')||company?.id===params.get('companyId'))&&
    (params.get('recentlyFunded')!=='1'||!!company&&!!recentFunding(company,now))&&
    (params.get('freshers')!=='1'||isFresher(job));
}

const literal=value=>"'"+value.replaceAll("'","''")+"'";
export function exploreConditions(params,args,now=new Date()){
  if(!isExploreSearch(params))return [];
  const conditions=[`payload->>'title' ~* ${literal(frontend)}`,`(payload->>'location' ~* ${literal(india)} OR (payload->'remote'->>'scope' IN ('worldwide','india') AND COALESCE(payload->'enrichment'->>'arrangement',payload->>'mode')='Remote'))`];
  if(params.get('companyGroup')||params.get('companyId')||params.get('recentlyFunded')==='1'){
    const identity=companyIdentitySQL(args);
    const eligible=companies.filter(c=>(!params.get('companyGroup')||c.groups.includes(params.get('companyGroup')))&&(!params.get('companyId')||c.id===params.get('companyId'))&&(params.get('recentlyFunded')!=='1'||recentFunding(c,now)));
    args.push(eligible.map(c=>c.id));conditions.push(`${identity}=ANY($${args.length}::text[])`);
  }
  if(params.get('freshers')==='1'){
    const value="concat_ws(' ',payload->>'experience',payload->>'summary',payload->'enrichment'->>'description')";
    const min="(payload->'enrichment'->>'yearsMin')::numeric";
    conditions.push(`NOT (payload->>'title' ~* ${literal(senior)})`,"COALESCE(payload->'enrichment'->>'seniority','') NOT IN ('Senior','Lead','Staff','Mid')",
      `COALESCE(${min},0)<=1`,`NOT (${value} ~* ${literal(higherWords)})`,`NOT (concat_ws(' ',${value},payload->>'title') ~* ${literal(excludedEntry)})`,
      `NOT EXISTS(SELECT 1 FROM regexp_matches(${value},${literal(years)},'gi') AS requirement WHERE (requirement[2])::int>1)`,
      `(${min} IS NOT NULL OR ${value} ~* ${literal(years)} OR payload->>'title' ~* ${literal(entry)} OR payload->>'experience' ~* ${literal(entry)} OR payload->'enrichment'->>'careerStage' IN ('Internship','Graduate','Entry-level') OR ${value} ~* ${literal(noExperience)})`);
  }
  return conditions;
}

export function collectionCompanies(params,now=new Date()){
  return companies.filter(c=>(!params.get('companyGroup')||c.groups.includes(params.get('companyGroup')))&&(params.get('recentlyFunded')!=='1'||recentFunding(c,now)))
    .sort((a,b)=>params.get('recentlyFunded')==='1'?recentFunding(b,now).announced.localeCompare(recentFunding(a,now).announced):a.name.localeCompare(b.name));
}

export function exploreParameters(slug,search=new URLSearchParams()){
  const collection=exploreCollections.find(item=>item.slug===slug);
  if(!collection)return null;
  const result=new URLSearchParams(search);
  for(const key of ['companyGroup','companyId','recentlyFunded','freshers','limit'])result.delete(key);
  for(const [key,value] of Object.entries(collection.filters))result.set(key,value);
  if(result.get('collection')==='remote'){result.delete('mode');result.delete('city')}
  return result;
}

export function companyIdentitySQL(args){
  args.push(JSON.stringify(companies.map(c=>({id:c.id,aliases:c.aliases.map(n=>n.trim().toLowerCase()),sources:c.sources}))));
  return `(SELECT c.id FROM jsonb_to_recordset($${args.length}::jsonb) AS c(id text,aliases jsonb,sources jsonb) WHERE c.sources ? jobs.source OR c.aliases ? lower(trim(payload->>'company')) ORDER BY (c.sources ? jobs.source) DESC LIMIT 1)`;
}
