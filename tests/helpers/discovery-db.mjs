import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

export async function discoveryDatabase(){
  const pg=new PGlite();
  for(const name of ['001-init.sql','002-employer-discovery.sql']){
    await pg.exec(await readFile(new URL('../../packages/database/schema/'+name,import.meta.url),'utf8'));
  }
  let tail=Promise.resolve();
  const connect=async()=>{
    const previous=tail;
    let unlock;
    tail=new Promise(resolve=>{unlock=resolve});
    await previous;
    return {query:(...args)=>pg.query(...args),release:()=>unlock()};
  };
  const db={connect,query:async(...args)=>{
    const client=await connect();
    try{return await client.query(...args)}finally{client.release()}
  }};
  return {db,pg,close:()=>pg.close()};
}
