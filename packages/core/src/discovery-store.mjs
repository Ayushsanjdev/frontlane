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
