// This module is used only by browser-server.mjs's test-only Vite alias.
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite();
await db.exec(await readFile(new URL('../../packages/database/schema/001-init.sql',import.meta.url),'utf8'));
const jobs=JSON.parse(await readFile(new URL('../../packages/database/data/seed.json',import.meta.url),'utf8'));
for(const {requisitionId,...job} of jobs){
  await db.query('INSERT INTO jobs(id,source,canonical_url,payload) VALUES($1,$2,$3,$4)',[job.id,job.source,job.url,job]);
}
await db.query("INSERT INTO source_checks(source,checked_at,status,matched) VALUES('greenhouse:example',now(),'ok',20)");
export function database(){return db}
