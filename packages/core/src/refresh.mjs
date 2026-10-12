export async function withRefreshLock(db,refresh){
  const client=await db.connect();
  let finished=false,discard=false;
  try{
    await client.query('BEGIN');
    const lock=await client.query("SELECT pg_try_advisory_xact_lock(hashtext('frontlane-refresh')) AS locked");
    if(!lock.rows[0].locked){
      await client.query('ROLLBACK');finished=true;
      return {skipped:'Refresh already running'};
    }
    const sources=await refresh(client);
    await client.query('COMMIT');finished=true;
    return {sources};
  }finally{
    if(!finished){try{await client.query('ROLLBACK')}catch{discard=true}}
    client.release(discard);
  }
}
