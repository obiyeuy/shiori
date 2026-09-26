import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
export async function testDatabase():Promise<Pool>{
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required for real PostgreSQL verification');
 const admin=new Pool({connectionString:process.env.DATABASE_URL});
 const schema='test_'+randomUUID().replaceAll('-','');
 try{await admin.query(`CREATE SCHEMA ${schema}`);}finally{await admin.end();}
 const pool=new Pool({connectionString:process.env.DATABASE_URL,options:`-c search_path=${schema}`});
 try{await pool.query(await readFile('drizzle/0000_initial.sql','utf8'));await pool.query(await readFile('drizzle/0001_content_pipeline.sql','utf8'));await pool.query(await readFile('drizzle/0002_public_search.sql','utf8'));return pool;}catch(e){await pool.end();throw e;}
 // Retain schemas for inspection; no test cleanup deletes user files or directories.
}
