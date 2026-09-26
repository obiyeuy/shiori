import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { transaction } from './transaction.js';
export async function applyMigration(pool:Pool,name:string,sql:string):Promise<'applied'|'already-applied'>{
 return transaction(pool,async db=>{
  await db.query('SELECT pg_advisory_xact_lock(71624610)');
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const checksum=createHash('sha256').update(sql).digest('hex');
  const {rows}=await db.query('SELECT checksum FROM schema_migrations WHERE name=$1',[name]);
  if(rows[0]){if(rows[0].checksum!==checksum)throw new Error('migration checksum mismatch');return 'already-applied';}
  await db.query(sql);await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);return 'applied';
 });
}
