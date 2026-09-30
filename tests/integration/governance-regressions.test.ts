import {afterAll,expect,it,vi} from 'vitest';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {testDatabase} from '../helpers/database.js';
import {ContentRepository} from '../../src/lib/server/content/repository.js';
import {MediaService} from '../../src/lib/server/media/service.js';
vi.mock('node:fs/promises',async(importOriginal)=>{
 const real=await importOriginal<typeof import('node:fs/promises')>();
 return {...real,writeFile:vi.fn(real.writeFile),statfs:async(path:string)=>({...await real.statfs(path),blocks:100,bavail:50})};
});
const pool=await testDatabase();afterAll(()=>pool.end());
it('does not expose a second publication or public read API from the draft repository',()=>{
 const repo=new ContentRepository(pool);
 for(const method of ['publish','publishFixture','getPublicVersionBySlug','getCurrentPublicBySlug'])expect(method in repo).toBe(false);
});
it('failed original writes retain failure metadata without a nonexistent backup variant',async()=>{
 const root=await mkdtemp(join(tmpdir(),'governance-write-failure-'));
 const service=new MediaService(pool,root);
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();
 vi.mocked(writeFile).mockRejectedValueOnce(new Error('injected disk failure'));
 await expect(service.stageUpload({name:'write-failure.png',bytes})).rejects.toThrow('injected disk failure');
 const row=(await pool.query("SELECT * FROM media WHERE name='write-failure.png'")).rows[0];
 expect(row.state).toBe('failed');
 expect((await pool.query('SELECT * FROM media_variants WHERE media_key=$1',[row.key])).rowCount).toBe(0);
});
it('retains and recovers an original when variant registration fails',async()=>{
 const root=await mkdtemp(join(tmpdir(),'governance-registration-failure-'));
 const service=new MediaService(pool,root);
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();
 await pool.query(`CREATE FUNCTION fail_original_registration() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.variant='original' AND current_setting('governance.fail_registration',true) IS DISTINCT FROM 'off' THEN RAISE EXCEPTION 'injected registration failure'; END IF; RETURN NEW; END $$;
 CREATE TRIGGER registration_fault BEFORE INSERT ON media_variants FOR EACH ROW EXECUTE FUNCTION fail_original_registration()`);
 await expect(service.stageUpload({name:'registration-failure.png',bytes})).rejects.toThrow();
 const row=(await pool.query("SELECT * FROM media WHERE name='registration-failure.png'")).rows[0];
 expect(row).toBeDefined();
 expect(row.state).toBe('failed');
 expect(await readFile(join(root,`${row.key}-original`))).toEqual(bytes);
 await pool.query('ALTER TABLE media_variants DISABLE TRIGGER registration_fault');
 await service.process(row.key);
 expect((await service.get(row.key)).state).toBe('ready');
 expect((await pool.query('SELECT * FROM media_variants WHERE media_key=$1',[row.key])).rowCount).toBe(2);
});
it('does not register an incomplete original left by an interrupted write',async()=>{
 const root=await mkdtemp(join(tmpdir(),'governance-partial-write-'));
 const service=new MediaService(pool,root);
 const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();
 const real=await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
 vi.mocked(writeFile).mockImplementationOnce(async(path,_data,options)=>{
  await real.writeFile(path,bytes.subarray(0,16),options);
  throw new Error('injected interrupted write');
 });
 await expect(service.stageUpload({name:'partial-write.png',bytes})).rejects.toThrow('injected interrupted write');
 const row=(await pool.query("SELECT * FROM media WHERE name='partial-write.png'")).rows[0];
 await expect(service.process(row.key)).rejects.toThrow();
 expect((await service.get(row.key)).state).toBe('failed');
 expect((await pool.query('SELECT * FROM media_variants WHERE media_key=$1',[row.key])).rowCount).toBe(0);
 expect(await readFile(join(root,`${row.key}-original`))).toEqual(bytes.subarray(0,16));
});
