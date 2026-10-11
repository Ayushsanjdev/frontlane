import {database} from '@/core/db.mjs';
export async function GET(){try{await database().query('SELECT 1');return Response.json({status:'ok'},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({status:'unavailable'},{status:503})}}
