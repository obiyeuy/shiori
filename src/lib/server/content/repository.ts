import {recordReferences} from '../media/references.js';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { transaction } from '../db/transaction.js';
import { contentTypes, type Conflict, type ContentType, type DraftInput } from './types.js';
import { validateDraft } from './validation.js';
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
 async archive(id:string,archived:boolean):Promise<void>{await this.pool.query('UPDATE content_items SET archived=$1 WHERE id=$2',[archived,id]);}

}
export type DbClient=Pool|PoolClient;
