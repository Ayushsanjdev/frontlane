import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {reserveSearch,searchAllowance} from './discovery-budget.mjs';
import {seedEmployers,upsertCandidates,claimCandidates,recordVerification} from './employers.mjs';
import {parseBoardUrl,verifyCandidate} from './board-discovery.mjs';
import {boundedDiscoveryDatabase,DiscoveryDeadline} from './discovery-store.mjs';

const hosts=['job-boards.greenhouse.io','boards.greenhouse.io','jobs.lever.co','jobs.smartrecruiters.com'];
const roles=['frontend engineer','React developer','Angular developer','Vue developer','UI engineer','web developer'];
const locations=['India','Bengaluru','Hyderabad','Pune','worldwide remote','anywhere in the world'];
export function discoveryQuery(index){
  const length=hosts.length*roles.length*locations.length;
  const n=((index%length)+length)%length;
  const host=hosts[n%hosts.length],role=roles[Math.floor(n/hosts.length)%roles.length],location=locations[Math.floor(n/(hosts.length*roles.length))];
  return {q:`site:${host} "${role}" "${location}"`,...(Math.floor(index/length)%2?{freshness:'pm'}:{})};
}

/**
 * @param {any} db
 * @param {{apiKey?:string,fetchImpl?:typeof fetch,now?:()=>Date,timeoutMs?:number}} [options]
 */
export async function runDiscovery(db,{apiKey,fetchImpl=fetch,now=()=>new Date(),timeoutMs=20000}={}){
  const runId=randomUUID(),started=now(),start=performance.now();
  const limit=Math.max(1,Math.min(20000,timeoutMs)),deadline=AbortSignal.timeout(limit);
  const workDb=boundedDiscoveryDatabase(db,start+limit);
  const completionDb=boundedDiscoveryDatabase(db,start+limit+5000);
  const lease=await completionDb.query('UPDATE discovery_state SET lease_token=$1,lease_expires_at=$2 WHERE id=true AND (lease_expires_at IS NULL OR lease_expires_at<=$3) RETURNING id',[runId,new Date(started.getTime()+60000),started]);
  if(!lease.rows.length)return {status:'busy'};
  const summary={runId,status:'complete',searchesReserved:0,searchesSucceeded:0,candidatesAdded:0,verified:0,registered:0,noMatch:0,pending:0,failed:0,deferred:0,allowance:null};
  let verifiedAttempts=0;
  const canStart=()=>!deadline.aborted&&performance.now()-start<limit-6000;
  const requestSignal=()=>AbortSignal.any([deadline,AbortSignal.timeout(6000)]);
  const verifyQueued=async()=>{
    while(verifiedAttempts<4&&canStart()){
      const [candidate]=await claimCandidates(workDb,{now:now(),limit:1,leaseMs:60000});
      if(!candidate)break;
      verifiedAttempts++;
      const result=await verifyCandidate(candidate,{fetchImpl,signal:requestSignal(),now:now()});
      const receipt=await recordVerification(workDb,candidate,result,{now:now()});
      if(result.status==='verified')summary.verified++;
      else if(result.status==='no-match')summary.noMatch++;
      else if(result.status==='pending')summary.pending++;
      else summary.failed++;
      if(receipt.registered)summary.registered++;
    }
  };
  try{
    await completionDb.query('INSERT INTO discovery_runs(id,started_at,status) VALUES($1,$2,$3)',[runId,started,'running']);
    if(canStart())await seedEmployers(workDb);
    await verifyQueued();
    if(!apiKey)summary.status='missing-key';
    else{
      for(let attempt=0;attempt<2&&canStart();attempt++){
        const reservation=await reserveSearch(workDb,{now:now()});
        if(!reservation.allowed){summary.status='budget-exhausted';break}
        summary.searchesReserved++;
        const query=discoveryQuery(reservation.queryIndex);
        let results;
        try{
          const url=new URL('https://api.search.brave.com/res/v1/web/search');
          for(const [key,value] of Object.entries({...query,count:'20',country:'IN',search_lang:'en'}))url.searchParams.set(key,String(value));
          const response=await fetchImpl(url,{redirect:'error',headers:{'X-Subscription-Token':apiKey,Accept:'application/json'},signal:requestSignal()});
          if(!response.ok||response.redirected)throw Error('Search unavailable');
          const data=await response.json();
          if(!Array.isArray(data.web?.results))throw Error('Malformed search results');
          results=data.web.results.slice(0,20);summary.searchesSucceeded++;
        }catch{summary.failed++;continue}
        // Persistence failures must surface: a paid search is counted even if saving its leads fails.
        const candidates=results.map(result=>parseBoardUrl(result?.url)).filter(Boolean).map(candidate=>({...candidate,query:query.q}));
        summary.candidatesAdded+=await upsertCandidates(workDb,candidates,{now:now()});
      }
    }
    await verifyQueued();
    summary.allowance=await searchAllowance(completionDb,{now:now()});
    summary.deferred=(await completionDb.query("SELECT count(*)::int AS count FROM discovery_candidates WHERE status<>'verified'")).rows[0].count;
    if(summary.status==='complete'&&(summary.failed||!canStart()))summary.status='partial';
    await completionDb.query('UPDATE discovery_runs SET completed_at=$2,status=$3,summary=$4 WHERE id=$1',[runId,now(),summary.status,summary]);
    return summary;
  }catch(error){
    if(error instanceof DiscoveryDeadline){
      summary.status='partial';
      summary.allowance=await searchAllowance(completionDb,{now:now()});
      summary.deferred=(await completionDb.query("SELECT count(*)::int AS count FROM discovery_candidates WHERE status<>'verified'")).rows[0].count;
      await completionDb.query('UPDATE discovery_runs SET completed_at=$2,status=$3,summary=$4 WHERE id=$1',[runId,now(),summary.status,summary]);
      return summary;
    }
    await completionDb.query("UPDATE discovery_runs SET completed_at=$2,status='failed',summary=$3 WHERE id=$1",[runId,now(),{...summary,status:'failed'}]);
    throw error;
  }finally{
    await completionDb.query('UPDATE discovery_state SET lease_token=NULL,lease_expires_at=NULL WHERE id=true AND lease_token=$1',[runId]);
  }
}
