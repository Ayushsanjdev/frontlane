import {createHash} from 'node:crypto';
import {z} from 'zod';
import {JobInput,canonicalUrl,jobId} from './ingestion.mjs';
import {eligible} from './sources.mjs';
import {discoveryTransaction} from './discovery-store.mjs';

const optionalText=(max,fallback)=>z.string().trim().max(max).optional().transform(value=>value||fallback);
const submission=z.object({
  submissionId:z.string().uuid(),
  title:z.string().trim().min(2,'Enter a job title.').max(160),
  company:z.string().trim().min(1,'Enter the company name.').max(120),
  location:z.string().trim().min(2,'Enter a job location.').max(200),
  mode:JobInput.shape.mode,type:JobInput.shape.type,
  url:JobInput.shape.url,
  summary:z.string().trim().min(40,'Add a description of at least 40 characters.').max(1500),
  salary:optionalText(160,'Not disclosed'),experience:optionalText(160,'See employer requirements'),
  eligibility:optionalText(400,'Review employer location and work eligibility requirements'),
  degree:optionalText(300,'Review employer requirements'),
  tags:z.array(z.string().trim().min(1).max(40)).max(15).default([]),
}).strict();

export class PublicJobError extends Error {
  constructor(message,status){super(message);this.name='PublicJobError';this.status=status}
}

/** @param {any} db @param {string} userId @param {unknown} input @param {{now?:Date}} [options] */
export async function publishPublicJob(db,userId,input,{now=new Date()}={}){
  if(!userId)throw new PublicJobError('Sign in required',401);
  const {submissionId,...fields}=submission.parse(input);
  fields.url=canonicalUrl(fields.url);
  fields.tags=[...new Set(fields.tags)];
  if(!eligible(fields.title,fields.location,fields.summary+' '+fields.eligibility))throw new PublicJobError('Post a frontend role located in India or explicitly open worldwide.',400);
  const hash=createHash('sha256').update(JSON.stringify(fields)).digest('hex');
  return discoveryTransaction(db,async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtext('frontlane-publication'))");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",['public-jobs:user:'+userId]);
    const previous=(await client.query('SELECT owner_id,job_id,body_hash FROM job_publications WHERE id=$1',[submissionId])).rows[0];
    if(previous){
      if(previous.owner_id!==userId||previous.body_hash!==hash)throw new PublicJobError('This submission has changed. Please submit it again.',409);
      const row=(await client.query('SELECT payload FROM jobs WHERE id=$1 AND active=true',[previous.job_id])).rows[0];
      if(!row)throw new PublicJobError('This listing is no longer public.',409);
      return {job:row.payload,replayed:true};
    }
    const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())),end=new Date(start.getTime()+86400000);
    const count=(await client.query('SELECT count(*)::int AS count FROM job_publications WHERE owner_id=$1 AND created_at>=$2 AND created_at<$3',[userId,start,end])).rows[0].count;
    if(count>=10)throw new PublicJobError('You can publish up to 10 jobs per day. Please try again tomorrow.',429);
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['public-jobs:url:'+fields.url]);
    const duplicate=await client.query('SELECT id FROM jobs WHERE canonical_url=$1 AND (active=true OR source=$2) LIMIT 1',[fields.url,'community']);
    if(duplicate.rows.length)throw new PublicJobError('This application link is already listed on the job board.',409);
    const job=JobInput.parse({...fields,checked:now.toISOString(),posted:null,caveat:'Community-submitted listing. Verify availability, employer identity and requirements before applying.'});
    const id=jobId('community',job),payload={...job,id,source:'community',discovered:now.toISOString().slice(0,10)};
    await client.query('INSERT INTO jobs(id,source,canonical_url,payload,discovered_at) VALUES($1,$2,$3,$4,$5)',[id,'community',job.url,payload,now]);
    await client.query('INSERT INTO job_first_publications(canonical_url,job_id,published_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[job.url,id,now]);
    await client.query('INSERT INTO job_publications(id,owner_id,job_id,body_hash,created_at) VALUES($1,$2,$3,$4,$5)',[submissionId,userId,id,hash,now]);
    return {job:payload,replayed:false};
  }).catch(error=>{
    if(error?.code==='23505')throw new PublicJobError('This job has already been submitted. Please refresh the board.',409);
    throw error;
  });
}
