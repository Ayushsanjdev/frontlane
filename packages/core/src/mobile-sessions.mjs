import {createHash,randomBytes} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';

const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
const hash=token=>createHash('sha256').update(token).digest('hex');
export class MobileAuthError extends Error {
  constructor(message='Sign in required',status=401){super(message);this.name='MobileAuthError';this.status=status}
}

export function bearerToken(request){
  const value=request.headers.get('authorization');
  if(value===null)return null;
  const match=/^Bearer ([A-Za-z0-9_-]{43})$/i.exec(value);
  if(!match)throw new MobileAuthError();
  return match[1];
}

/** @param {string} token @param {string} audience @param {{keys?:any,now?:Date}} options */
export async function verifyGoogleToken(token,audience,{keys=googleKeys,now=new Date()}={}){
  if(!audience?.trim())throw new MobileAuthError('Mobile sign-in is not configured',503);
  if(typeof token!=='string'||token.length>12000)throw new MobileAuthError();
  let payload;
  try{
    ({payload}=await jwtVerify(token,keys,{audience,issuer:['accounts.google.com','https://accounts.google.com'],algorithms:['RS256'],currentDate:now,requiredClaims:['sub','exp','iat','email','email_verified']}));
  }catch{throw new MobileAuthError()}
  if(typeof payload.sub!=='string'||!payload.sub||payload.sub.length>200||payload.email_verified!==true||typeof payload.email!=='string'||typeof payload.iat!=='number'||payload.iat>Math.floor(now.getTime()/1000))throw new MobileAuthError();
  return {userId:'google:'+payload.sub,name:typeof payload.name==='string'?payload.name.slice(0,200):'Developer',email:payload.email};
}

export async function createMobileSession(db,user,{now=new Date()}={}){
  const token=randomBytes(32).toString('base64url');
  const expiresAt=new Date(now.getTime()+30*86400000).toISOString();
  await db.query('DELETE FROM mobile_sessions WHERE user_id=$1 AND expires_at<=$2',[user.userId,now]);
  await db.query('INSERT INTO mobile_sessions(token_hash,user_id,payload,expires_at) VALUES($1,$2,$3,$4)',[hash(token),user.userId,user,expiresAt]);
  return {token,user,expiresAt};
}

export async function loadMobileSession(db,token,{now=new Date()}={}){
  if(!tokenPattern.test(token))return null;
  const row=(await db.query('SELECT user_id,payload,expires_at FROM mobile_sessions WHERE token_hash=$1 AND expires_at>$2',[hash(token),now])).rows[0];
  return row?{user:{...row.payload,userId:row.user_id},expiresAt:new Date(row.expires_at).toISOString()}:null;
}

export async function revokeMobileSession(db,token){
  if(!tokenPattern.test(token))throw new MobileAuthError();
  await db.query('DELETE FROM mobile_sessions WHERE token_hash=$1',[hash(token)]);
}
