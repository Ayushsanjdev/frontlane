import {z} from 'zod';

const skills=z.array(z.string().max(40)).max(30);
export const JobEnrichmentInput=z.object({
  description:z.string().max(40000),
  arrangement:z.enum(['Remote','Hybrid','Onsite','Unknown']),
  seniority:z.enum(['Junior','Mid','Senior','Lead','Staff']).optional(),
  yearsMin:z.number().min(0).max(50).optional(),yearsMax:z.number().min(0).max(50).optional(),
  compensation:z.object({min:z.number().finite().nonnegative(),max:z.number().finite().nonnegative(),currency:z.string().regex(/^[A-Z]{3}$/),period:z.enum(['year','month','hour']),sourceText:z.string().max(200)}).refine(v=>v.min<=v.max).optional(),
  requiredSkills:skills.optional(),preferredSkills:skills.optional(),benefits:z.array(z.string().max(200)).max(20).optional(),
  evidence:z.string().max(1000).optional(),
}).strict();

export function technologyTokens(text){
  const candidates=['React Native','Next.js','React','TypeScript','Tailwind','Redux','AWS','JavaScript','Angular','Vue','Svelte'];
  const remaining=String(text).replace(/\bReact\s+Native\b/gi,'');
  return candidates.filter(tag=>{
    const value=tag==='React'?remaining:String(text);
    const escaped=tag.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp('(?:^|[^a-z0-9])'+escaped+'(?=$|[^a-z0-9])','i').test(value);
  });
}

export function enrichJob({title,description,arrangement='Unknown'}){
  const result={description:description.slice(0,40000),arrangement};
  const section=label=>description.match(new RegExp('\\b(?:'+label+')\\s*:\\s*([\\s\\S]*?)(?=\\b(?:required skills|requirements|preferred skills|nice to have|benefits|responsibilities)\\s*:|$)','i'))?.[1]?.trim();
  const required=section('required skills|requirements'),preferred=section('preferred skills|nice to have'),benefits=section('benefits');
  if(required)result.requiredSkills=technologyTokens(required);
  if(preferred)result.preferredSkills=technologyTokens(preferred);
  if(benefits)result.benefits=benefits.split(/[;•\n]/).map(v=>v.trim()).filter(Boolean).slice(0,20).map(v=>v.slice(0,200));
  const years=[...description.matchAll(/\b(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\+?\s+years?\s+(?:of\s+)?experience\b/gi)];
  if(years.length===1){
    const min=Number(years[0][1]),max=years[0][2]?Number(years[0][2]):undefined;
    if(min<=50&&(!max||max>=min&&max<=50)){result.yearsMin=min;if(max)result.yearsMax=max;result.evidence=years[0][0]}
  }
  for(const [pattern,level] of [[/\bstaff\b/i,'Staff'],[/\blead\b/i,'Lead'],[/\bsenior|\bsr\.?\b/i,'Senior'],[/\bjunior|\bjr\.?\b/i,'Junior'],[/\bmid[ -]?level\b/i,'Mid']])if(pattern.test(title)){result.seniority=level;break}
  const pay=[...description.matchAll(/\b(INR|USD|EUR|GBP)\s+([\d,]+)(?:\s*[-–]\s*([\d,]+))?\s+(?:per\s+|\/)(year|month|hour)\b/gi)];
  if(pay.length===1){const [,currency,low,high,period]=pay[0],min=Number(low.replaceAll(',','')),max=Number((high||low).replaceAll(',',''));if(min<=max)result.compensation={min,max,currency:currency.toUpperCase(),period:period.toLowerCase(),sourceText:pay[0][0]}}
  return JobEnrichmentInput.parse(result);
}
