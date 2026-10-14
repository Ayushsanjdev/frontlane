import {performance} from 'node:perf_hooks';

export class DiscoveryDeadline extends Error {
  constructor(){super('Discovery work deadline reached');this.name='DiscoveryDeadline'}
}

export function boundedDiscoveryDatabase(db,end){
  const query=async(target,text,values)=>{
    const remaining=Math.floor(end-performance.now());
    if(remaining<=0)throw new DiscoveryDeadline();
    try{return await target.query({text,values,query_timeout:remaining})}
    catch(error){if(performance.now()>=end||error.message==='Query read timeout')throw new DiscoveryDeadline();throw error}
  };
  return {
    query:(text,values)=>query(db,text,values),
    connect:async()=>{
      const client=await db.connect();
      if(performance.now()>=end){client.release();throw new DiscoveryDeadline()}
      return {query:(text,values)=>query(client,text,values),release:discard=>client.release(discard)};
    },
  };
}

export async function discoveryTransaction(db,work){
  const client=await db.connect();
  let finished=false,discard=false;
  try{
    await client.query('BEGIN');
    const result=await work(client);
    await client.query('COMMIT');finished=true;
    return result;
  }finally{
    if(!finished){try{await client.query('ROLLBACK')}catch{discard=true}}
    client.release(discard);
  }
}
