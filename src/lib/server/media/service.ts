import type {Pool,PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {mkdir,stat,statfs,writeFile,readFile,realpath} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import sharp from 'sharp';
import {inspectUpload,capacityDecision} from './validation.js';
export type Media={key:string;name:string;mime:string;bytes:number;state:'pending'|'processing'|'ready'|'failed';error:string|null;animated:boolean;width:number|null;height:number|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export class MediaService {
 readonly root:string;
 constructor(private pool:Pool,root:string){if(!root)throw new Error('MEDIA_ROOT 未配置');this.root=resolve(root);}
 async capacity(db:Pool|PoolClient=this.pool){
  await mkdir(this.root,{recursive:true,mode:0o700});
  const info=await stat(this.root);if(info.mode&0o077)throw new Error('媒体目录权限须为 0700');
  const fs=await statfs(this.root);const ratio=fs.blocks?fs.bavail/fs.blocks:null;
  const sample={ratio,bytes:fs.bavail*fs.bsize,collectedAt:new Date().toISOString(),decision:capacityDecision(ratio)};
  await db.query(`INSERT INTO operation_status(key,event_at,collected_at,state,detail) VALUES('media-capacity',now(),now(),$1,$2)
  ON CONFLICT(key) DO UPDATE SET event_at=excluded.event_at,collected_at=excluded.collected_at,state=excluded.state,detail=excluded.detail`,[sample.decision==='ok'?'success':'failure',sample]);
  return sample;
 }
 async stageUpload(input:{name:string;bytes:Buffer}):Promise<Media>{
  if((await this.capacity()).decision==='stop')throw new Error('存储容量不足或未知，暂停新增媒体');
  const meta=await inspectUpload(input.bytes,input.name);const key=randomUUID();const fileKey=`${key}-original`;
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN');
   await client.query('INSERT INTO media(key,name,mime,bytes,state,width,height,animated) VALUES($1,$2,$3,$4,\'pending\',$5,$6,$7)',[key,input.name.slice(0,200),meta.mime,input.bytes.length,meta.width??null,meta.height??null,meta.animated]);
   await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  try{await writeFile(join(this.root,fileKey),input.bytes,{flag:'wx',mode:0o600});}
  catch(e){await this.pool.query('UPDATE media SET state=\'failed\',error=$2 WHERE key=$1',[key,e instanceof Error?e.message:'文件暂存失败']);throw e;}
  try{await this.pool.query("INSERT INTO media_variants(media_key,variant,file_key,mime,bytes) VALUES($1,'original',$2,$3,$4)",[key,fileKey,meta.mime,input.bytes.length]);}
  catch(e){await this.pool.query('UPDATE media SET state=\'failed\',error=$2 WHERE key=$1',[key,e instanceof Error?e.message:'媒体登记失败']);throw e;}
  return this.get(key);
 }
 async get(key:string,db:Pool|PoolClient=this.pool):Promise<Media>{if(!uuid.test(key))throw new Error('无效媒体键');const row=(await db.query('SELECT * FROM media WHERE key=$1',[key])).rows[0];if(!row)throw new Error('媒体不存在');return row;}
 async process(key:string):Promise<void>{
  if(!uuid.test(key))throw new Error('无效媒体键');
  const client=await this.pool.connect();
  try{
   // Session lock is automatically released on process disconnect; retries recover processing items.
   await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))',[key]);
   const media=await this.get(key,client);if(media.state==='ready')return;
   if((await this.capacity(client)).decision==='stop')throw new Error('存储容量不足或未知');
   const originalKey=`${key}-original`;
   const originalPath=join(this.root,originalKey);
   const originalStat=await stat(originalPath);
   if(originalStat.size!==Number(media.bytes))throw new Error('原始媒体文件不完整，等待重新上传');
   const registered=await client.query("SELECT 1 FROM media_variants WHERE media_key=$1 AND variant='original'",[key]);
   if(!registered.rowCount)await client.query("INSERT INTO media_variants(media_key,variant,file_key,mime,bytes) VALUES($1,'original',$2,$3,$4)",[key,originalKey,media.mime,originalStat.size]);
   await client.query("UPDATE media SET state='processing',error=NULL WHERE key=$1",[key]);
   const original=await this.authorizeMedia(true,key,'original',client);
   if(media.mime.startsWith('image/')&&!media.animated){
    const data=await sharp(await readFile(original.path),{limitInputPixels:40_000_000}).rotate().resize({width:1920,height:1920,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
    const fileKey=`${key}-${randomUUID()}.webp`;await writeFile(join(this.root,fileKey),data,{flag:'wx',mode:0o600});
    await client.query("INSERT INTO media_variants(media_key,variant,file_key,mime,bytes) VALUES($1,'display',$2,'image/webp',$3) ON CONFLICT DO NOTHING",[key,fileKey,data.length]);
   }
   await client.query("UPDATE media SET state='ready',error=NULL,processed_at=now(),processor=$2 WHERE key=$1",[key,JSON.stringify(sharp.versions)]);
  }catch(e){await client.query("UPDATE media SET state='failed',error=$2 WHERE key=$1",[key,e instanceof Error?e.message:'处理失败']);throw e;}
  finally{await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))',[key]).catch(()=>undefined);client.release();}
 }
 async authorizeMedia(owner:boolean,key:string,variant:string,db:Pool|PoolClient=this.pool):Promise<{path:string;mime:string;bytes:number;name:string}>{
  if(!uuid.test(key)||!['display','original'].includes(variant))throw new Error('无效媒体键');
  const r=(await db.query('SELECT v.*,m.name FROM media_variants v JOIN media m ON m.key=v.media_key WHERE media_key=$1 AND variant=$2',[key,variant])).rows[0];
  if(!r||(!owner&&!r.public_at))throw new Error('媒体不存在或未公开');
  const root=await realpath(this.root);const path=await realpath(join(root,r.file_key));
  if(!path.startsWith(root+sep)||!(await stat(path)).isFile())throw new Error('媒体不可读取');
  return {path,mime:r.mime,bytes:Number(r.bytes),name:r.name};
 }
}
