import {database} from '@frontlane/database/client';
import {listJobs,getJob,filterSeedJobs} from '@frontlane/core/jobs';
import {seedJobs} from '@/lib/seed';
import type {Job,JobCollection} from '@/lib/types';

export async function jobCollection(params=new URLSearchParams()):Promise<JobCollection>{
  try{return await listJobs(database(),params)}
  catch{return filterSeedJobs(seedJobs,params)}
}

export async function jobDetail(id:string):Promise<{job:Job|null;fallback:boolean}>{
  try{return {job:await getJob(database(),id),fallback:false}}
  catch{return {job:seedJobs.find(job=>job.id===id)||null,fallback:true}}
}
