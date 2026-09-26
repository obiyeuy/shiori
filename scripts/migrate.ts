import { readFile } from 'node:fs/promises';
import { createDbPool } from '../src/lib/server/db/client.js';
import { applyMigration } from '../src/lib/server/db/migrate.js';
const pool=createDbPool();
try{
 const sql=await readFile(new URL('../drizzle/0000_initial.sql',import.meta.url),'utf8');
 console.log('0000_initial:',await applyMigration(pool,'0000_initial',sql));
}catch{console.error('Migration failed; stop rollout and inspect the migration in an isolated database.');process.exitCode=1;}
finally{await pool.end();}
