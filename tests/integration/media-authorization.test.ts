import {it,expect,afterAll,vi} from 'vitest';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {testDatabase} from '../helpers/database.js';
import {MediaService} from '../../src/lib/server/media/service.js';
vi.mock('node:fs/promises',async(importOriginal)=>{const real=await importOriginal<typeof import('node:fs/promises')>();return {...real,statfs:async(path:string)=>({...await real.statfs(path),blocks:100,bavail:50})};});
const pool=await testDatabase();afterAll(()=>pool.end());
it('retains originals, makes display variants, denies anonymous staged files and rejects traversal',async()=>{
 const root=await mkdtemp(join(tmpdir(),'personal-site-p1-media-'));
 const service=new MediaService(pool,root);
 const bytes=await sharp({create:{width:10,height:10,channels:4,background:'#fff'}}).png().toBuffer();
 const item=await service.stageUpload({name:'screenshot.png',bytes});
 expect(item.state).toBe('pending');
 await service.process(item.key);
 expect((await service.get(item.key)).state).toBe('ready');
 await expect(service.authorizeMedia(false,item.key,'display')).rejects.toThrow(/未公开/);
 const original=await service.authorizeMedia(true,item.key,'original');
 expect(await readFile(original.path)).toEqual(bytes);
 await pool.query("UPDATE media_variants SET public_at=now() WHERE media_key=$1 AND variant='display'",[item.key]);
 expect((await service.authorizeMedia(false,item.key,'display')).mime).toBe('image/webp');
 await expect(service.authorizeMedia(false,item.key,'original')).rejects.toThrow(/未公开/);
 await expect(service.authorizeMedia(true,'../x','original')).rejects.toThrow();
});
it('failed processing retains bytes for retry and serializes processors',async()=>{
 const root=await mkdtemp(join(tmpdir(),'personal-site-p1-retry-'));const service=new MediaService(pool,root);
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();
 const item=await service.stageUpload({name:'x.png',bytes});
 await pool.query("UPDATE media SET state='failed',error='interrupted' WHERE key=$1",[item.key]);
 await Promise.all([service.process(item.key),service.process(item.key)]);
 expect((await service.get(item.key)).state).toBe('ready');
 expect((await pool.query('SELECT * FROM media_variants WHERE media_key=$1',[item.key])).rowCount).toBe(2);
});
it('processes with a one-connection pool without nested-pool deadlock',async()=>{
 const {Pool}=await import('pg');const single=new Pool({connectionString:process.env.DATABASE_URL,options:pool.options.options,max:1,connectionTimeoutMillis:150});
 try{const root=await mkdtemp(join(tmpdir(),'personal-site-p1-single-'));const service=new MediaService(single,root);const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();const item=await service.stageUpload({name:'x.png',bytes});await service.process(item.key);expect((await service.get(item.key)).state).toBe('ready');}finally{await single.end();}
});
it('tracks draft, history and scheduled references without publishing their variants',async()=>{
 const {ContentRepository}=await import('../../src/lib/server/content/repository.js');const {EditorService}=await import('../../src/lib/server/content/editor.js');
 const service=new MediaService(pool,await mkdtemp(join(tmpdir(),'personal-site-p1-reference-')));const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();const media=await service.stageUpload({name:'x.png',bytes});
 const repo=new ContentRepository(pool);const id=await repo.createContent('article');await repo.saveDraft(id,{title:'t',slug:'ref',body:`![说明](media:${media.key})`},0);const v=await new EditorService(pool).snapshot(id,1,'manual');
 expect((await pool.query('SELECT * FROM media_references WHERE content_id=$1 AND scope=\'draft\'',[id])).rowCount).toBe(1);
 expect((await pool.query('SELECT * FROM media_references WHERE version_id=$1',[v])).rowCount).toBe(1);
 expect((await pool.query('SELECT public_at FROM media_variants WHERE media_key=$1',[media.key])).rows.every(r=>r.public_at===null)).toBe(true);
});
