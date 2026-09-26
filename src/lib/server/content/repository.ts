import {recordReferences} from '../media/references.js';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { transaction } from '../db/transaction.js';
import { validateDraft } from './validation.js';
import { contentTypes, type Conflict, type ContentType, type DraftInput, type PublicVersion } from './types.js';
export class ContentRepository {
 constructor(private readonly pool:Pool){}
 async createContent(type:ContentType):Promise<string>{
  if(!contentTypes.includes(type))throw new Error('invalid content type');
  const id=randomUUID();await this.pool.query('INSERT INTO content_items(id,type) VALUES($1,$2)',[id,type]);return id;
 }
 async saveDraft(id:string,patch:Partial<DraftInput>,expectedRevision:number):Promise<{revision:number}|Conflict>{
  if(!Number.isInteger(expectedRevision)||expectedRevision<0)throw new Error('invalid revision');
  return transaction(this.pool,async client=>{
   const content=await client.query('SELECT type FROM content_items WHERE id=$1 FOR UPDATE',[id]);
   if(!content.rowCount)throw new Error('content not found');
   const current=await client.query('SELECT revision,payload,checkpoint_at FROM drafts WHERE content_id=$1',[id]);
   const row=current.rows[0];const revision=row?.revision ?? 0;
   if(revision!==expectedRevision)return {kind:'conflict',localRevision:expectedRevision,serverRevision:revision,serverDraft:row?.payload ?? null};
   if(patch.type && patch.type!==content.rows[0].type)throw new Error('content type mismatch');
   const payload={...(row?{}:{commentsEnabled:['article','note','project'].includes(content.rows[0].type),...(content.rows[0].type==='tool'?{toolStatus:'unavailable'}:{})}),...row?.payload,...patch,type:content.rows[0].type};
   if(!validateDraft(payload,'draft').ok)throw new Error('invalid draft');
   await client.query(`INSERT INTO drafts(id,content_id,revision,payload) VALUES($1,$2,$3,$4)
     ON CONFLICT(content_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated_at=clock_timestamp()`,[randomUUID(),id,revision+1,payload]);
   await recordReferences(client,id,payload,revision+1);
   if(row && JSON.stringify(row.payload)!==JSON.stringify(payload) && Date.now()-new Date(row.checkpoint_at).getTime()>=600_000){
    const checkpoint=randomUUID();
    await client.query("INSERT INTO versions(id,content_id,revision,payload,published_at,source) VALUES($1,$2,$3,$4,now(),'checkpoint')",[checkpoint,id,revision+1,payload]);
    await recordReferences(client,id,payload,revision+1,checkpoint);
    await client.query('UPDATE drafts SET checkpoint_at=now() WHERE content_id=$1',[id]);
   }
   return {revision:revision+1};
  });
 }
 /** Internal foundation primitive. P1 must add preflight, revision confirmation, idempotency and schedule policy before exposing publication to HTTP. */
 async publish(contentId:string,input:Partial<DraftInput>):Promise<PublicVersion>{
  return transaction(this.pool,async client=>{
   const content=await client.query('SELECT type FROM content_items WHERE id=$1 FOR UPDATE',[contentId]);
   if(!content.rowCount)throw new Error('content not found');
   const payload={...input,type:content.rows[0].type} as DraftInput;
   if(!validateDraft(payload,'publish').ok)throw new Error('publish input is incomplete or invalid');
   const reserved=await client.query(`INSERT INTO url_aliases(content_id,type,slug) VALUES($1,$2,$3) ON CONFLICT(type,slug) DO NOTHING RETURNING content_id`,[contentId,payload.type,payload.slug]);
   if(!reserved.rowCount){
    const alias=await client.query('SELECT content_id FROM url_aliases WHERE type=$1 AND slug=$2',[payload.type,payload.slug]);
    if(alias.rows[0]?.content_id!==contentId)throw new Error('slug is already assigned');
   }
   const draft=await client.query('SELECT revision FROM drafts WHERE content_id=$1',[contentId]);
   const id=randomUUID();const now=new Date();
   await client.query('INSERT INTO versions(id,content_id,revision,payload,published_at) VALUES($1,$2,$3,$4,$5)',[id,contentId,draft.rows[0]?.revision ?? 0,payload,now]);
   await client.query('UPDATE content_items SET public_version_id=$1,first_published_at=COALESCE(first_published_at,$3) WHERE id=$2',[id,contentId,now]);
   return {id,contentId,type:payload.type,slug:payload.slug!,title:payload.title ?? '',body:payload.body ?? '',publishedAt:now};
  });
 }
 async archive(id:string,archived:boolean):Promise<void>{await this.pool.query('UPDATE content_items SET archived=$1 WHERE id=$2',[archived,id]);}
 async getPublicVersionBySlug(type:ContentType,slug:string):Promise<PublicVersion|null>{
  const {rows}=await this.pool.query(`SELECT v.id,v.content_id,c.type,v.payload->>'slug' AS slug,v.payload->>'title' AS title,v.payload->>'body' AS body,COALESCE(p.published_at,v.published_at) AS published_at
   FROM url_aliases a JOIN content_items c ON c.id=a.content_id JOIN versions v ON v.id=c.public_version_id AND v.content_id=c.id
   LEFT JOIN public_content p ON p.content_id=c.id AND p.version_id=v.id
   WHERE a.type=$1 AND a.slug=$2`,[type,slug]);
  const row=rows[0];return row?{id:row.id,contentId:row.content_id,type:row.type,slug:row.slug,title:row.title ?? '',body:row.body ?? '',publishedAt:row.published_at}:null;
 }
}
export type DbClient=Pool|PoolClient;
