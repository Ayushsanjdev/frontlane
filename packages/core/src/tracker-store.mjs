import {z} from 'zod';
import {parseApplication} from './tracker.mjs';
import {WorkspaceInput} from './workspace-model.mjs';
import {discoveryTransaction} from './discovery-store.mjs';

export class WorkspaceError extends Error {constructor(message,status){super(message);this.status=status}}
const patch=z.object({id:z.string().uuid(),revision:z.number().int().nonnegative(),changes:z.object({completeFollowUp:z.boolean().optional(),job:z.unknown().optional(),stage:z.string().optional(),notes:z.string().max(6000).optional(),answers:z.string().max(6000).optional(),appliedAt:z.string().optional(),evidence:z.string().max(1000).optional(),followUp:z.string().optional(),workspace:WorkspaceInput.partial().optional()}).strict()}).strict();
export async function patchApplication(db,userId,input){
  const {id,revision,changes}=patch.parse(input);
  return discoveryTransaction(db,async client=>{
    const row=(await client.query('SELECT payload,revision FROM applications WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,userId])).rows[0];
    if(!row)throw new WorkspaceError('Application not found',404);
    if(row.revision!==revision)throw new WorkspaceError('This application changed in another tab. Refresh before saving.',409);
    const {completeFollowUp,...fields}=changes;
    if(completeFollowUp&&(!row.payload.followUp||fields.followUp!==''))throw new WorkspaceError('Choose an existing follow-up to complete.',400);
    const item=parseApplication({...row.payload,...fields,workspace:{...row.payload.workspace,...changes.workspace},updatedAt:new Date().toISOString()});
    const saved=await client.query('UPDATE applications SET payload=$3,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING payload',[id,userId,item]);
    if(completeFollowUp)await client.query("INSERT INTO application_activity(application_id,user_id,kind) VALUES($1,$2,'follow-up-completed')",[id,userId]);
    const payload=saved.rows[0].payload;
    const current=(await client.query('SELECT source_available FROM jobs WHERE id=$1',[payload.jobId])).rows[0];
    return {...payload,job:{...payload.job,availability:current?.source_available===true?'available':current?.source_available===false?'closed':'unknown'}};
  });
}
export async function listApplications(db,userId,{cursor='',limit=50,archived='all'}={}){
  let boundary;
  if(cursor){try{boundary=JSON.parse(Buffer.from(cursor,'base64url').toString());z.object({at:z.string().datetime({offset:true}),id:z.string().uuid()}).strict().parse(boundary)}catch{throw new WorkspaceError('Invalid page cursor',400)}}
  const args=[userId],where=['user_id=$1'];
  if(boundary){args.push(boundary.at,boundary.id);where.push(`(updated_at,id)<($${args.length-1}::timestamptz,$${args.length}::uuid)`)}
  if(archived==='true')where.push("payload->'workspace'->>'archived'='true'");
  if(archived==='false')where.push("COALESCE(payload->'workspace'->>'archived','false')='false'");
  const count=Math.min(100,Math.max(1,Number(limit)||50));args.push(count+1);
  const result=await db.query(`SELECT payload,updated_at,id FROM applications WHERE ${where.join(' AND ')} ORDER BY updated_at DESC,id DESC LIMIT $${args.length}`,args);
  const more=result.rows.length>count,rows=result.rows.slice(0,count),last=rows.at(-1);
  const availability=(await db.query('SELECT id,source_available FROM jobs WHERE id=ANY($1::text[])',[rows.map(row=>row.payload.jobId)])).rows;
  const status=new Map(availability.map(row=>[row.id,row.source_available===true?'available':row.source_available===false?'closed':'unknown']));
  return {items:rows.map(row=>({...row.payload,job:{...row.payload.job,availability:status.get(row.payload.jobId)||'unknown'}})),nextCursor:more?Buffer.from(JSON.stringify({at:new Date(last.updated_at).toISOString(),id:last.id})).toString('base64url'):null};
}
export async function applicationHistory(db,userId,id){
  z.string().uuid().parse(id);
  return (await db.query('SELECT kind,detail,created_at FROM application_activity WHERE application_id=$1 AND user_id=$2 ORDER BY created_at DESC,id DESC LIMIT 200',[id,userId])).rows;
}
