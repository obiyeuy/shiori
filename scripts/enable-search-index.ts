import { createDbPool } from '../src/lib/server/db/client.js';
import { applyMigration } from '../src/lib/server/db/migrate.js';
const pool=createDbPool();
try{
 console.log(await applyMigration(pool,'optional_public_search_trgm',`CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
 CREATE INDEX public_search_title_trgm ON public_content USING gin (search_title public.gin_trgm_ops);
 CREATE INDEX public_search_summary_trgm ON public_content USING gin (search_summary public.gin_trgm_ops);
 CREATE INDEX public_search_body_trgm ON public_content USING gin (search_body public.gin_trgm_ops);`));
}catch{console.error('Optional search index unavailable; use bounded literal search in P2.');process.exitCode=1;}
finally{await pool.end();}
