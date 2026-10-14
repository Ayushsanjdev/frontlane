import {WorkspaceInput} from './workspace-model.mjs';
import {JobEnrichmentInput} from './job-enrichment.mjs';
import {z} from 'zod';

const text=n=>z.string().max(n);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
  const date=new Date(value+'T00:00:00Z');
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
},'Use a valid calendar date');
const optionalDay=z.union([day,z.literal('')]).default('');
const url=z.string().url().max(2000).refine(value=>{
  const u=new URL(value);
  return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;
},'Use an HTTP or HTTPS application link');
const Job=z.object({
  id:z.string().trim().min(1).max(200),
  title:z.string().trim().min(1).max(160),
  company:z.string().trim().min(1).max(120),
  location:text(200),mode:z.enum(['Remote','Hybrid','Onsite']),
  type:z.enum(['Full-time','Freelance','Part-time','Contract']),
  salary:text(160),tags:z.array(text(40)).max(15),experience:text(160),
  summary:text(1800),caveat:text(600),url,source:text(101),
  discovered:day,checked:z.union([z.string().datetime({offset:true}),z.literal('')]),
  posted:z.string().datetime({offset:true}).nullable(),
  eligibility:text(400),degree:text(300),enrichment:JobEnrichmentInput.optional(),availability:z.enum(['available','closed','unknown']).optional(),companyId:text(101).optional(),
}).strict();
const Application=z.object({
  id:z.union([z.string().uuid(),z.literal('')]).optional(),
  jobId:z.string().trim().min(1).max(200).optional(),job:Job,
  workspace:WorkspaceInput.optional(),revision:z.number().int().nonnegative().optional(),
  stage:z.enum(['Saved','Preparing','Applied','Interview','Offer','Rejected','Withdrawn']),
  notes:text(6000).default(''),answers:text(6000).default(''),
  evidence:text(1000).default(''),appliedAt:optionalDay,followUp:optionalDay,
  updatedAt:z.union([z.string().datetime({offset:true}),z.literal('')]).optional(),
}).strict().superRefine((item,ctx)=>{
  if(item.jobId&&item.jobId!==item.job.id)ctx.addIssue({code:'custom',path:['jobId'],message:'Job IDs must match'});
  if(['Applied','Interview','Offer'].includes(item.stage)&&(!item.appliedAt||!item.evidence.trim())){
    ctx.addIssue({code:'custom',path:['evidence'],message:'Add the application date and a receipt or your confirmation.'});
  }
});

export function parseApplication(input){
  const item=Application.parse(input);
  return {...item,jobId:item.jobId||item.job.id};
}
export function parseRemoval(input){return z.object({id:z.string().uuid()}).strict().parse(input)}

export function parseSave(input){
  const {job}=z.object({action:z.literal('save'),job:Job}).strict().parse(input);
  return parseApplication({job,stage:'Saved'});
}
