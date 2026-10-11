import {readFile} from 'node:fs/promises';import {ingest} from '../core/ingestion.mjs';import {database} from '../core/db.mjs';
const jobs=JSON.parse(await readFile(new URL('../db/seed.json',import.meta.url),'utf8'));try{console.log(await ingest({source:'curated:starter',runId:'starter-2026-10-11',jobs}))}finally{await database().end()}
