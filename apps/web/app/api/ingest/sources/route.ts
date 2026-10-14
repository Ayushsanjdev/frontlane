import {z} from 'zod';
import {authorized} from '@frontlanejobs/core/ingestion';
import {seedEmployers,registeredSources,markEmployerChecks} from '@frontlanejobs/core/employers';
import {database} from '@frontlanejobs/database/client';
export const runtime='nodejs';
const sourceId=z.string().regex(/^(greenhouse|lever|smartrecruiters):[a-z0-9][a-z0-9_-]{0,80}$/);
const checked=z.object({checkedSources:z.array(sourceId).max(100),selectedSources:z.array(sourceId).max(100).default([])}).strict().refine(value=>value.selectedSources.every(source=>value.checkedSources.includes(source)));

export async function GET(request:Request){
  if(!authorized(request,process.env.INGEST_TOKEN))return Response.json({error:'Unauthorized'},{status:401});
  try{
    const db=database();
    await seedEmployers(db);
    return Response.json(await registeredSources(db),{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Employer registry unavailable'},{status:503})}
}

export async function POST(request:Request){
  if(!authorized(request,process.env.INGEST_TOKEN))return Response.json({error:'Unauthorized'},{status:401});
  let input;
  try{
    const body=await request.text();
    if(body.length>12000)return Response.json({error:'Invalid source checks'},{status:400});
    input=checked.parse(JSON.parse(body));
  }catch{return Response.json({error:'Invalid source checks'},{status:400})}
  try{
    const selected=new Set(input.selectedSources);
    await markEmployerChecks(database(),[...new Set(input.checkedSources)].map(source=>({source,status:selected.has(source)?'ok':'attempted',matched:selected.has(source)?1:0})));
    return Response.json({accepted:new Set(input.checkedSources).size},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Employer check acknowledgement unavailable'},{status:503})}
}
