import pg from 'pg';
let pool;
export function database(){if(!process.env.DATABASE_URL)throw Error('Database is not configured');return pool??=new pg.Pool({connectionString:process.env.DATABASE_URL,max:Number(process.env.DB_POOL_SIZE||5),idleTimeoutMillis:10000,connectionTimeoutMillis:5000,statement_timeout:10000,...(process.env.DB_SSL==='true'?{ssl:{rejectUnauthorized:true}}:{})})}
export async function transaction(fn){const c=await database().connect();try{await c.query('BEGIN');const value=await fn(c);await c.query('COMMIT');return value}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}
