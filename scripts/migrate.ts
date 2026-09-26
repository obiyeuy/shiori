import { readFile } from 'node:fs/promises';
import { createDbPool } from '../src/lib/server/db/client.js';
import { applyMigration } from '../src/lib/server/db/migrate.js';
const pool=createDbPool();
try{
 for(const name of ['0000_initial','0001_content_pipeline']){
 const sql=await readFile(new URL(`../drizzle/${name}.sql`,import.meta.url),'utf8');
 console.log(name,await applyMigration(pool,name,sql));
 }
}catch{console.error('Migration failed; stop rollout and inspect the migration in an isolated database.');process.exitCode=1;}
finally{await pool.end();}
