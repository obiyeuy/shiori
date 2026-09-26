import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {DraftInput} from '../content/types.js';
import {renderMarkdown} from '../markdown/render.js';
export async function recordReferences(db:PoolClient,contentId:string,payload:DraftInput,revision:number,versionId:string|null=null){
 const doc=await renderMarkdown(payload.body??'','public');
 const references=[...doc.media,...(payload.cover?[{key:payload.cover,variant:'display'}]:[]),...(payload.gallery??[]).map(key=>({key,variant:'display'}))];
 for(const ref of references)await db.query(`INSERT INTO media_references(id,content_id,version_id,media_key,variant,scope,revision)
  SELECT $1,$2,$3,key,$5,$6,$7 FROM media WHERE key=$4`,[randomUUID(),contentId,versionId,ref.key,ref.variant,versionId?'version':'draft',revision]);
}
