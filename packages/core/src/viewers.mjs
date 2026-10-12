export async function recordViewer(db,id){
  await db.query(`INSERT INTO viewers(id,last_seen_at) VALUES($1,now())
    ON CONFLICT(id) DO UPDATE SET last_seen_at=GREATEST(viewers.last_seen_at,excluded.last_seen_at)`,[id]);
  const {rows}=await db.query(`SELECT count(*) AS total,
    count(*) FILTER(WHERE last_seen_at>now()-interval '90 seconds') AS current FROM viewers`);
  return {total:Number(rows[0].total),current:Number(rows[0].current)};
}
