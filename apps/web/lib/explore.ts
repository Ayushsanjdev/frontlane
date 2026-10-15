import {isExploreSearch} from '@frontlanejobs/core/explore';
import {companyJobCounts,matchesJobSearch,deduplicateJobs} from '@frontlanejobs/core/jobs';
import {resolveCompany} from '@frontlanejobs/database/companies';
import {database} from '@frontlanejobs/database/client';
import {seedJobs} from './seed';

export async function companyCounts(params=new URLSearchParams()):Promise<{counts:Record<string,number>;fallback:boolean}>{
  try{return {counts:await companyJobCounts(database(),params),fallback:false}}
  catch{
    const counts:Record<string,number>={};
    // Count the whole fallback dataset, without pagination.
    const matching=seedJobs.filter(job=>matchesJobSearch(job,params));
    for(const job of params.get('collection')==='remote'||isExploreSearch(params)?deduplicateJobs(matching):matching){
      const company=resolveCompany(job);if(company)counts[company.id]=(counts[company.id]||0)+1;
    }
    return {counts,fallback:true};
  }
}

export function searchParameters(input:Record<string,string|string[]|undefined>){
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(input))for(const entry of Array.isArray(value)?value:value?[value]:[])params.append(key,entry);
  params.delete('limit');return params;
}
