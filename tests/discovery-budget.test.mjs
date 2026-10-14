import {test} from 'node:test';
import assert from 'node:assert/strict';
import {discoveryDatabase} from './helpers/discovery-db.mjs';
import {reserveSearch,searchAllowance} from '../packages/core/src/discovery-budget.mjs';

test('concurrent requests obey durable daily caps and advance queries only on reservation',async()=>{
  const f=await discoveryDatabase(),now=new Date('2026-10-14T12:00:00Z');
  try{
    const results=await Promise.all(Array.from({length:40},()=>reserveSearch(f.db,{now})));
    assert.equal(results.filter(r=>r.allowed).length,30);
    assert.equal(new Set(results.filter(r=>r.allowed).map(r=>r.queryIndex)).size,30);
    assert.deepEqual(await searchAllowance(f.db,{now}),{dayUsed:30,monthUsed:30,dayRemaining:0,monthRemaining:970});
    assert.equal((await reserveSearch(f.db,{now:new Date('2026-10-15T00:00:00Z')})).allowed,true);
    assert.equal((await reserveSearch(f.db,{now:new Date('2026-11-01T00:00:00Z')})).monthUsed,1);
    // A separate transaction failing after a request cannot refund the request.
    const client=await f.db.connect();
    await client.query('BEGIN');await client.query('ROLLBACK');client.release();
    assert.equal((await searchAllowance(f.db,{now})).dayUsed,30);
  }finally{await f.close()}
});

test('monthly defense denies searches even when the daily allowance remains',async()=>{
  const f=await discoveryDatabase(),now=new Date('2026-10-14T12:00:00Z');
  try{
    await f.db.query("INSERT INTO discovery_requests(id,reserved_at,query_index) SELECT md5(n::text)::uuid,'2026-10-01T12:00:00Z'::timestamptz,n FROM generate_series(1,999) n");
    assert.equal((await reserveSearch(f.db,{now})).allowed,true);
    const denied=await reserveSearch(f.db,{now});
    assert.equal(denied.allowed,false);assert.equal(denied.reason,'monthly-limit');
    assert.equal((await searchAllowance(f.db,{now})).monthRemaining,0);
  }finally{await f.close()}
});
