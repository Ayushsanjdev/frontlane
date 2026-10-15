import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRemoteOk,parseWwr,parseHnComment,fetchRemoteFeeds} from '../packages/core/src/remote-sources.mjs';
import {refreshRemoteJobs} from '../packages/core/src/remote-refresh.mjs';
import {ingest} from '@frontlanejobs/core/ingestion';
import {discoveryDatabase} from './helpers/discovery-db.mjs';
const checked=new Date().toISOString();
const row={id:'123',position:'Frontend Engineer',company:'Acme',location:'Worldwide',description:'Fully remote. Build React interfaces.',url:'https://remoteok.com/remote-jobs/123',date:'2026-01-01T00:00:00Z'};
const rss=`<?xml version="1.0"?><rss version="2.0"><channel><title>WWR</title><item><title>Acme: Frontend Engineer</title><link>https://weworkremotely.com/remote-jobs/acme-frontend</link><guid>acme-frontend</guid><region>Anywhere in the World</region><description><![CDATA[<p>Fully remote. Build React.</p>]]></description><pubDate>Wed, 14 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>`;

test('free providers normalize valid frontend roles with attribution and reject ambiguous eligibility',()=>{
  const jobs=parseRemoteOk([{legal:'terms'},row,{...row,id:'124',location:'Remote',description:'Build React.'},{...row,id:'125',position:'Backend Engineer'}],checked);
  assert.equal(jobs.length,1);assert.equal(jobs[0].remote.sourceName,'Remote OK');assert.equal(jobs[0].remote.sourceUrl,row.url);
  const wwr=parseWwr(rss,checked);assert.equal(wwr.length,1);assert.equal(wwr[0].company,'Acme');assert.equal(wwr[0].remote.scope,'worldwide');
  assert.throws(()=>parseWwr('<rss><broken>',checked));assert.throws(()=>parseRemoteOk({jobs:[]},checked));
});

test('HN accepts explicit top-level frontend headers and skips replies and ambiguous multi-role posts',()=>{
  const comment={objectID:'100',parent_id:10,created_at:'2026-01-01T00:00:00Z',comment_text:'Acme | Frontend Engineer | REMOTE (Worldwide) | Full-time<p>Build React interfaces. 4 hours overlap with CET.</p>'};
  const jobs=parseHnComment(comment,10,checked);assert.equal(jobs.length,1);assert.equal(jobs[0].company,'Acme');assert.equal(jobs[0].remote.sourceName,'Hacker News');assert.match(jobs[0].remote.timezone,/CET/);
  for(const patch of [{parent_id:11},{comment_text:'Acme | Hiring engineers | Remote worldwide<p>Frontend and backend openings.</p>'},{comment_text:'Acme | Frontend Engineer and Backend Engineer | Remote worldwide'},{comment_text:'Acme | Frontend Engineer | Remote (US only)'},{dead:true},{deleted:true}])assert.deepEqual(parseHnComment({...comment,...patch},10,checked),[]);
});

function providerFetch(url){
  url=new URL(url);
  if(url.hostname==='remoteok.com')return Promise.resolve(Response.json([row]));
  if(url.hostname==='weworkremotely.com')return Promise.resolve(new Response(rss));
  if(url.pathname.endsWith('/search_by_date')&&url.searchParams.get('tags')==='story,author_whoishiring')return Promise.resolve(Response.json({hits:[{objectID:'10',author:'whoishiring',title:'Ask HN: Who is hiring? (October 2026)'}],nbPages:1}));
  if(url.hostname==='hn.algolia.com')return Promise.resolve(Response.json({hits:[{objectID:'100',parent_id:10,comment_text:'Acme | React Developer | Remote worldwide',created_at:'2026-01-01T00:00:00Z'}],nbPages:1}));
  throw Error('Unexpected URL '+url);
}
test('bounded fetches isolate provider failures and report truncated HN pagination',async()=>{
  const feeds=await fetchRemoteFeeds({checked,fetchImpl:providerFetch});assert.equal(feeds.length,3);assert.ok(feeds.every(f=>f.status==='ok'));
  const failed=await fetchRemoteFeeds({checked,fetchImpl:async url=>String(url).includes('remoteok')?new Response('bad',{status:503}):providerFetch(url)});
  assert.equal(failed.find(f=>f.source==='remoteok:public').status,'failed');assert.equal(failed.find(f=>f.source==='wwr:programming').status,'ok');
});
test('remote refresh is additive, expires only stale aggregator jobs and records failures',async()=>{
  const {db,close}=await discoveryDatabase();
  try{
    const job=parseRemoteOk([row],checked)[0];
    await ingest({source:'greenhouse:acme',runId:'employer-remote',jobs:[{...job,url:'https://example.com/employer'}]},db);
    await ingest({source:'remoteok:public',runId:'stale-remote-1',jobs:[{...job,requisitionId:'stale',url:'https://remoteok.com/remote-jobs/stale',remote:{...job.remote,lastSeen:'2020-01-01T00:00:00Z'}}]},db);
    const result=await refreshRemoteJobs(db,{fetchImpl:providerFetch});assert.equal(result.sources.length,3);assert.equal(result.expired,1);
    assert.equal((await db.query("SELECT active FROM jobs WHERE source='greenhouse:acme'")).rows[0].active,true);
    const before=(await db.query("SELECT payload FROM jobs WHERE source='remoteok:public' AND active=true")).rows;
    const failed=await refreshRemoteJobs(db,{fetchImpl:async()=>{throw Error('network unavailable')}});assert.ok(failed.sources.every(f=>f.status==='failed'));
    assert.deepEqual((await db.query("SELECT payload FROM jobs WHERE source='remoteok:public' AND active=true")).rows,before);
    assert.equal((await db.query("SELECT status FROM source_checks WHERE source='remoteok:public'")).rows[0].status,'failed');
  }finally{await close()}
});

test('HN pagination caps report partial and oversized feeds fail without affecting other providers',async()=>{
  let pages=0;
  const feeds=await fetchRemoteFeeds({checked,fetchImpl:async url=>{
    const parsed=new URL(url);
    if(parsed.searchParams.get('tags')==='comment,story_10'){pages++;return Response.json({hits:[],nbPages:11})}
    if(parsed.hostname==='remoteok.com')return new Response('[]',{headers:{'content-length':'9000000'}});
    return providerFetch(url);
  }});
  assert.equal(pages,10);assert.equal(feeds.find(f=>f.source==='hn:whoishiring').status,'partial');
  assert.equal(feeds.find(f=>f.source==='remoteok:public').status,'failed');assert.equal(feeds.find(f=>f.source==='wwr:programming').status,'ok');
});

test('a failed later ingestion chunk rolls back that entire provider, preserving earlier source snapshots',async()=>{
  const {db,close}=await discoveryDatabase();
  try{
    const previous=parseRemoteOk([row],checked)[0];
    await ingest({source:'remoteok:public',runId:'previous-good',jobs:[previous]},db);
    const rows=Array.from({length:101},(_,i)=>({...row,id:String(1000+i),url:'https://remoteok.com/remote-jobs/'+(1000+i)}));
    const failingDb={...db,connect:async()=>{
      const client=await db.connect();let inserts=0;
      return {release:client.release,query:async(sql,args)=>{
        if(sql.startsWith('INSERT INTO jobs(')&&++inserts===101)throw Error('Injected later chunk failure');
        return client.query(sql,args);
      }};
    }};
    const result=await refreshRemoteJobs(failingDb,{fetchImpl:async url=>String(url).includes('remoteok.com')?Response.json(rows):providerFetch(url)});
    assert.equal(result.sources.find(f=>f.source==='remoteok:public').status,'failed');
    assert.equal(result.sources.find(f=>f.source==='remoteok:public').matched,0);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM jobs WHERE source='remoteok:public' AND active=true")).rows[0].n,1);
    assert.equal((await db.query("SELECT payload->>'title' AS title FROM jobs WHERE source='remoteok:public'")).rows[0].title,previous.title);
  }finally{await close()}
});
