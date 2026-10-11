import {readFile} from 'node:fs/promises';import {database} from '../core/db.mjs';
const db=database();try{await db.query(await readFile(new URL('../db/001-init.sql',import.meta.url),'utf8'));console.log('Database schema ready')}finally{await db.end()}
