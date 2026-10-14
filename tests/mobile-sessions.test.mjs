import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createMobileSession,loadMobileSession,revokeMobileSession,bearerToken,verifyGoogleToken} from '../packages/core/src/mobile-sessions.mjs';

const now=new Date('2026-10-14T10:00:00Z');
test('mobile sessions store only a hash, share Google identity, expire and revoke independently',async()=>{
  const db=new PGlite();
  try{
    await db.exec(await readFile(new URL('../packages/database/schema/004-mobile-sessions.sql',import.meta.url),'utf8'));
    const user={userId:'google:123',name:'Alice',email:'alice@example.com'};
    const a=await createMobileSession(db,user,{now}),b=await createMobileSession(db,{...user,userId:'google:456'},{now});
    const rows=(await db.query('SELECT * FROM mobile_sessions')).rows;
    assert.equal(rows.length,2);
    assert.ok(rows.every(row=>row.token_hash!==a.token&&row.token_hash!==b.token));
    assert.equal((await loadMobileSession(db,a.token,{now})).user.userId,user.userId);
    assert.equal(await loadMobileSession(db,'x'.repeat(43),{now}),null);
    assert.equal(await loadMobileSession(db,a.token,{now:new Date(a.expiresAt)}),null);
    await revokeMobileSession(db,a.token);
    assert.equal(await loadMobileSession(db,a.token,{now}),null);
    assert.equal((await loadMobileSession(db,b.token,{now})).user.userId,'google:456');
  }finally{await db.close()}
});
test('bearer parsing rejects malformed credentials',()=>{
  assert.equal(bearerToken(new Request('https://example.com')),null);
  assert.equal(bearerToken(new Request('https://example.com',{headers:{authorization:'Bearer '+'a'.repeat(43)}})),'a'.repeat(43));
  for(const value of ['Basic abc','Bearer short','Bearer '+'a'.repeat(43)+' extra'])assert.throws(()=>bearerToken(new Request('https://example.com',{headers:{authorization:value}})),/Sign in required/);
});
test('Google verification fails closed without audience or valid signed token',async()=>{
  await assert.rejects(()=>verifyGoogleToken('fake',''),/not configured/);
  await assert.rejects(()=>verifyGoogleToken('fake','client-id'),/Sign in required/);
});

test('Google ID tokens require trusted signatures, issuer, audience, expiry and verified email',async()=>{
  const {createRequire}=await import('node:module');
  const require=createRequire(new URL('../packages/core/package.json',import.meta.url));
  const {generateKeyPair,exportJWK,SignJWT,createLocalJWKSet}=await import(require.resolve('jose'));
  const {publicKey,privateKey}=await generateKeyPair('RS256');
  const jwk={...await exportJWK(publicKey),kid:'test',alg:'RS256'};
  const keys=createLocalJWKSet({keys:[jwk]});
  const claims={sub:'123',email:'alice@example.com',email_verified:true,name:'Alice',iss:'https://accounts.google.com',aud:'web-client',iat:Math.floor(now.getTime()/1000),exp:Math.floor(now.getTime()/1000)+3600};
  const signed=async(payload,key=privateKey)=>new SignJWT(payload).setProtectedHeader({alg:'RS256',kid:'test'}).sign(key);
  assert.equal((await verifyGoogleToken(await signed(claims),'web-client',{keys,now})).userId,'google:123');
  for(const patch of [{iss:'https://evil.example'},{aud:'another-client'},{exp:claims.iat},{email_verified:false},{sub:''},{iat:claims.iat+3600}]){
    await assert.rejects(()=>signed({...claims,...patch}).then(token=>verifyGoogleToken(token,'web-client',{keys,now})),/Sign in required/);
  }
  const attacker=await generateKeyPair('RS256');
  await assert.rejects(()=>signed(claims,attacker.privateKey).then(token=>verifyGoogleToken(token,'web-client',{keys,now})),/Sign in required/);
});
