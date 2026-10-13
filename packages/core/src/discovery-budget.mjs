import {randomUUID} from 'node:crypto';
import {discoveryTransaction} from './discovery-store.mjs';

function ranges(now){
  return [new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())),new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1)),new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)),new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1))];
}
export async function searchAllowance(db,{now=new Date()}={}){
  const row=(await db.query(`SELECT count(*) FILTER(WHERE reserved_at>=$1 AND reserved_at<$2)::int AS daily,
    count(*) FILTER(WHERE reserved_at>=$3 AND reserved_at<$4)::int AS monthly FROM discovery_requests WHERE reserved_at>=$3 AND reserved_at<$4`,ranges(now))).rows[0];
  const dayUsed=row.daily,monthUsed=row.monthly;
  return {dayUsed,monthUsed,dayRemaining:Math.max(0,30-dayUsed),monthRemaining:Math.max(0,1000-monthUsed)};
}
export async function reserveSearch(db,{now=new Date()}={}){
  return discoveryTransaction(db,async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtext('frontlane-discovery-budget'))");
    const allowance=await searchAllowance(client,{now});
    if(!allowance.dayRemaining||!allowance.monthRemaining)return {allowed:false,...allowance,reason:!allowance.monthRemaining?'monthly-limit':'daily-limit'};
    const state=await client.query('UPDATE discovery_state SET next_query_index=next_query_index+1 WHERE id=true RETURNING next_query_index-1 AS query_index');
    if(!state.rows.length)throw Error('Discovery state unavailable');
    const attemptId=randomUUID(),queryIndex=Number(state.rows[0].query_index);
    await client.query('INSERT INTO discovery_requests(id,reserved_at,query_index) VALUES($1,$2,$3)',[attemptId,now,queryIndex]);
    return {allowed:true,attemptId,queryIndex,dayUsed:allowance.dayUsed+1,monthUsed:allowance.monthUsed+1};
  });
}
