import {z} from 'zod';
const text=n=>z.string().max(n);
const link=text(2000).refine(value=>!value||(/^https?:\/\//i.test(value)&&!new URL(value).username&&!new URL(value).password),'Use an HTTP or HTTPS link');
const id=text(100).min(1);
const date=text(10).refine(v=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,'Use a valid date');
export const MatchingPreferencesInput=z.object({
  skills:z.array(text(40)).max(30).default([]),roles:z.array(text(100)).max(10).default([]),cities:z.array(text(100)).max(10).default([]),
  arrangements:z.array(z.enum(['Remote','Hybrid','Onsite'])).max(3).default([]),types:z.array(z.enum(['Full-time','Freelance','Part-time','Contract'])).max(4).default([]),
  years:z.number().finite().min(0).max(50).optional(),salaryMin:z.number().finite().nonnegative().optional(),currency:z.enum(['INR','USD','EUR','GBP']).optional(),payPeriod:z.enum(['year','month','hour']).optional(),
}).strict();
export const WorkspaceInput=z.object({
  archived:z.boolean().default(false),priority:z.enum(['high','normal','low']).default('normal'),nextAction:text(500).default(''),
  timezone:text(100).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true}catch{return false}},'Choose a valid timezone').default('Asia/Kolkata'),
  contacts:z.array(z.object({id,name:text(120),role:text(120).default(''),email:z.union([z.string().email(),z.literal('')]).default(''),url:link.default(''),notes:text(3000).default('')})).max(100).default([]),
  interviews:z.array(z.object({id,title:text(160),at:z.string().datetime({offset:true}),duration:z.number().int().min(15).max(480).default(60),url:link.default(''),notes:text(6000).default(''),outcome:text(2000).default(''),status:z.enum(['scheduled','completed','cancelled']).default('scheduled')})).max(100).default([]),
  documents:z.array(z.object({id,label:text(160),url:link,usedAt:date.default('')})).max(100).default([]),
  checklist:z.array(z.object({id,label:text(200),done:z.boolean()})).max(30).default([]),
  preparation:text(6000).default(''),followUpDraft:text(6000).optional(),thankYouDraft:text(6000).optional(),
  offers:z.array(z.object({id,base:z.number().finite().nonnegative(),variable:z.number().finite().nonnegative().default(0),equity:text(1000).default(''),currency:z.enum(['INR','USD','EUR','GBP']),period:z.enum(['year','month','hour']),startDate:date.default(''),deadline:date.default(''),location:text(200).default('')})).max(3).default([]),
}).strict();
export function interviewCalendar(item){
  const escape=value=>String(value).replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;').replaceAll('\r','');
  const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FrontlaneJobs//Interview//EN','BEGIN:VEVENT','UID:'+escape(item.id)+'@frontlanejobs','DTSTAMP:'+stamp(Date.now()),'DTSTART:'+stamp(item.at),'DTEND:'+stamp(new Date(item.at).getTime()+(item.duration||60)*60000),'SUMMARY:'+escape(item.title),'DESCRIPTION:'+escape(item.notes||''),'URL:'+escape(item.url||''),'END:VEVENT','END:VCALENDAR'].map(line=>line.match(/.{1,70}/gu)?.join('\r\n ')||'').join('\r\n')+'\r\n';
}
