import {recordReferences} from '../media/references.js';
import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import type {ContentType,DraftInput,Conflict} from './types.js';
import {ContentRepository} from './repository.js';
import {transaction} from '../db/transaction.js';
export class EditorService {
 constructor(private pool:Pool){}
 async snapshot(id:string,revision:number,source:'manual'|'schedule'|'publish'):Promise<string>{
  return transaction(this.pool,async c=>{
   await c.query('SELECT id FROM content_items WHERE id=$1 FOR UPDATE',[id]);
   const d=(await c.query('SELECT * FROM drafts WHERE content_id=$1',[id])).rows[0];
   if(!d||d.revision!==revision)throw new Error('修订已变化，请重新核对');
   const version=randomUUID();await c.query('INSERT INTO versions(id,content_id,revision,payload,published_at,source) VALUES($1,$2,$3,$4,now(),$5)',[version,id,revision,d.payload,source]);await recordReferences(c,id,d.payload,revision,version);await c.query('UPDATE drafts SET checkpoint_at=now() WHERE content_id=$1',[id]);return version;
  });
 }
 async restoreVersion(id:string,version:string,revision:number):Promise<{revision:number}|Conflict>{
  const v=(await this.pool.query('SELECT payload FROM versions WHERE id=$1 AND content_id=$2',[version,id])).rows[0];
  if(!v)throw new Error('版本不存在');return transaction(this.pool,async c=>{await c.query('SELECT id FROM content_items WHERE id=$1 FOR UPDATE',[id]);const current=(await c.query('SELECT revision FROM drafts WHERE content_id=$1',[id])).rows[0];if(current?.revision!==revision)return {kind:'conflict',localRevision:revision,serverRevision:current?.revision??0,serverDraft:(await c.query('SELECT payload FROM drafts WHERE content_id=$1',[id])).rows[0]?.payload??null};await c.query('UPDATE drafts SET revision=revision+1,payload=$2,updated_at=clock_timestamp(),checkpoint_at=clock_timestamp() WHERE content_id=$1',[id,v.payload]);await recordReferences(c,id,v.payload,revision+1);return {revision:revision+1};});
 }
 async read(id:string):Promise<{payload:DraftInput;revision:number;updatedAt:string|null}>{
  const r=(await this.pool.query('SELECT c.type,d.payload,d.revision,d.updated_at FROM content_items c LEFT JOIN drafts d ON d.content_id=c.id WHERE c.id=$1',[id])).rows[0];
  if(!r)throw new Error('内容不存在');return {payload:r.payload??{type:r.type},revision:r.revision??0,updatedAt:r.updated_at?.toISOString()??null};
 }
 async importMarkdown(bytes:Buffer,name:string,type:ContentType):Promise<{id:string;warnings:string[]}>{
  if(!name.toLowerCase().endsWith('.md')||bytes.length>1024*1024)throw new Error('仅接受不超过 1 MiB 的 UTF-8 .md');
  const body=new TextDecoder('utf-8',{fatal:true}).decode(bytes);const repo=new ContentRepository(this.pool);
  const title=/^#\s+(.+)$/m.exec(body)?.[1];const id=await repo.createContent(type);
  await repo.saveDraft(id,{body,...(title?{title}:{}),slug:`draft-${id.slice(0,8)}`},0);
  const warnings=['导入只建立新草稿；站内媒体引用需要另外核对。'];
  if(body.startsWith('---'))warnings.push('未解析的元数据已原样保留在正文中。');return {id,warnings};
 }
 async exportMarkdown(id:string,choice:string):Promise<string>{
  if(choice==='draft')return (await this.read(id)).payload.body??'';
  const r=choice==='public'?await this.pool.query('SELECT v.payload FROM content_items c JOIN versions v ON v.id=c.public_version_id WHERE c.id=$1',[id]):await this.pool.query('SELECT payload FROM versions WHERE content_id=$1 AND id=$2',[id,choice]);
  if(!r.rowCount)throw new Error('版本不存在');return r.rows[0].payload.body??'';
 }
 async history(id:string){return (await this.pool.query('SELECT id,revision,payload,source,created_at FROM versions WHERE content_id=$1 ORDER BY created_at DESC LIMIT 100',[id])).rows;}
}
