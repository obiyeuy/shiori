import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { ContentRepository } from '../../src/lib/server/content/repository.js';
import { initializeOwner } from '../../src/lib/server/auth/service.js';
const pool = new Pool({connectionString: process.env.DATABASE_URL});
beforeAll(async () => {
 if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required: real PostgreSQL tests must not silently skip');
 const schema='test_'+randomUUID().replaceAll('-','');
 await pool.query(`CREATE SCHEMA ${schema}`);
 await pool.end();
 db=new Pool({connectionString:process.env.DATABASE_URL,options:`-c search_path=${schema}`});
 await db.query(await readFile('drizzle/0000_initial.sql','utf8'));
});
let db: Pool;
afterAll(async()=>{await db?.end();});
describe('production PostgreSQL constraints', () => {
 it('allows same slug across types, preserves aliases and returns canonical slug', async()=>{
  const repo=new ContentRepository(db);const a=await repo.createContent('article'); const n=await repo.createContent('note');
  await repo.publish(a,{title:'A',body:'text',slug:'shared'} as any);
  await repo.publish(n,{title:'N',body:'text',slug:'shared'} as any);
  await repo.publish(a,{title:'A2',body:'text2',slug:'new'} as any);
  expect((await repo.getPublicVersionBySlug('article','shared'))?.slug).toBe('new');
  const other=await repo.createContent('article');
  await expect(repo.publish(other,{title:'Other',body:'text',slug:'shared'} as any)).rejects.toThrow();
 });
 it('serializes first draft writes without losing either conflict payload',async()=>{
  const repo=new ContentRepository(db);const id=await repo.createContent('article');
  const results=await Promise.all([repo.saveDraft(id,{title:'A'} as any,0),repo.saveDraft(id,{title:'B'} as any,0)]);
  expect(results.filter(r=>'kind' in r)).toHaveLength(1);
  expect(results.filter(r=>'revision' in r)).toHaveLength(1);
 });
 it('prevents concurrent owner initialization',async()=>{
  const results=await Promise.allSettled([initializeOwner(db,{password:'test-owner-password-123'}),initializeOwner(db,{password:'test-owner-password-456'})]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((await db.query('select * from users')).rowCount).toBe(1);
 });
 it('rejects cross-content public pointers and immutable version edits',async()=>{
  const repo=new ContentRepository(db);const a=await repo.createContent('article');const b=await repo.createContent('article');
  const version=await repo.publish(a,{title:'Immutable',body:'body',slug:'immutable'} as any);
  await expect(db.query('update content_items set public_version_id=$1 where id=$2',[version.id,b])).rejects.toThrow();
  await expect(db.query('update versions set payload=$1 where id=$2',[{title:'changed'},version.id])).rejects.toThrow();
 });
});
it('keeps one unfinished schedule including failed tasks, and withdrawn aliases reveal nothing',async()=>{
 const repo=new ContentRepository(db);const id=await repo.createContent('article');
 const version=await repo.publish(id,{title:'Scheduling',body:'body',slug:'scheduling'});
 await db.query("INSERT INTO schedules(id,content_id,version_id,status,run_at) VALUES($1,$2,$3,'failed',now())",[randomUUID(),id,version.id]);
 await expect(db.query("INSERT INTO schedules(id,content_id,version_id,status,run_at) VALUES($1,$2,$3,'pending',now())",[randomUUID(),id,version.id])).rejects.toThrow();
 await db.query("UPDATE schedules SET status='cancelled' WHERE content_id=$1",[id]);
 await db.query("INSERT INTO schedules(id,content_id,version_id,status,run_at) VALUES($1,$2,$3,'pending',now())",[randomUUID(),id,version.id]);
 await db.query('UPDATE content_items SET public_version_id=NULL WHERE id=$1',[id]);
 expect(await repo.getPublicVersionBySlug('article','scheduling')).toBeNull();
});
