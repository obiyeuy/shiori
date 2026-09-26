import { createDbPool } from '../src/lib/server/db/client.js';
import { applyMigration } from '../src/lib/server/db/migrate.js';
const pool=createDbPool();
try{
 console.log(await applyMigration(pool,'optional_search_trgm',`CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
 CREATE INDEX versions_title_trgm ON versions USING gin ((payload->>'title') public.gin_trgm_ops);`));
}catch{console.error('Optional search index unavailable; use bounded literal search in P2.');process.exitCode=1;}
finally{await pool.end();}
