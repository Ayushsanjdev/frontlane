import {readFile,readdir} from 'node:fs/promises';
import {database} from '@frontlanejobs/database/client';
const db=database();
let client;
try{
  client=await db.connect();
  await client.query('BEGIN');
  const directory=new URL('../schema/',import.meta.url);
  for(const file of (await readdir(directory)).filter(name=>name.endsWith('.sql')).sort()){
    await client.query(await readFile(new URL(file,directory),'utf8'));
  }
  await client.query('COMMIT');
  console.log('Database schema ready');
}catch(error){
  if(client)await client.query('ROLLBACK');
  throw error;
}finally{client?.release();await db.end()}
