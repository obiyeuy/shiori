import { it,expect } from 'vitest';
import { Pool } from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as migrations from '../../src/lib/server/db/migrate.js';
it('applies once, detects checksum drift and rolls back failed DDL',async()=>{
 const schema='migration_'+randomUUID().replaceAll('-','');
 const admin=new Pool({connectionString:process.env.DATABASE_URL});await admin.query(`CREATE SCHEMA ${schema}`);await admin.end();
 const pool=new Pool({connectionString:process.env.DATABASE_URL,options:`-c search_path=${schema}`});
 try{
 const sql=await readFile('drizzle/0000_initial.sql','utf8');
 expect(await migrations.applyMigration(pool,'0000_initial',sql)).toBe('applied');
 expect(await migrations.applyMigration(pool,'0000_initial',sql)).toBe('already-applied');
 await expect(migrations.applyMigration(pool,'0000_initial',sql+'\n-- changed')).rejects.toThrow(/checksum/);
 await expect(migrations.applyMigration(pool,'broken','CREATE TABLE partial(id integer); SELECT missing_column;')).rejects.toThrow();
 expect((await pool.query("SELECT to_regclass('partial') AS table_name")).rows[0].table_name).toBeNull();
 }finally{await pool.end();}
});
