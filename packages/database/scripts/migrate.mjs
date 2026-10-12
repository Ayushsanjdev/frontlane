import {readFile} from 'node:fs/promises';import {database} from '@frontlane/database/client';
const db=database();try{await db.query(await readFile(new URL('../schema/001-init.sql',import.meta.url),'utf8'));console.log('Database schema ready')}finally{await db.end()}
