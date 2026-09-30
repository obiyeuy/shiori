import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {transaction} from '../../src/lib/server/db/transaction.js';
import {validateDraft} from '../../src/lib/server/content/validation.js';
import type {ContentType,DraftInput,PublicVersion} from '../../src/lib/server/content/types.js';

export async function publishFixture(pool:Pool,contentId:string,input:Partial<DraftInput>):Promise<PublicVersion>{
 return transaction(pool,async client=>{
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
  await client.query(`INSERT INTO public_content(content_id,version_id,type,slug,title,summary,body_text,rendered_html,payload,published_at,rss_id)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(content_id) DO UPDATE SET version_id=excluded.version_id,slug=excluded.slug,title=excluded.title,summary=excluded.summary,body_text=excluded.body_text,rendered_html=excluded.rendered_html,payload=excluded.payload,published_at=excluded.published_at`,[contentId,id,payload.type,payload.slug,payload.title??'',payload.summary??'',payload.body??'',payload.body??'',payload,now,`urn:uuid:${contentId}`]);
  return {id,contentId,type:payload.type,slug:payload.slug!,title:payload.title??'',body:payload.body??'',publishedAt:now};
 });
}

export async function getCurrentPublicBySlug(pool:Pool,type:ContentType,slug:string):Promise<PublicVersion|null>{
 const {rows}=await pool.query(`SELECT v.id,v.content_id,c.type,v.payload->>'slug' AS slug,v.payload->>'title' AS title,v.payload->>'body' AS body,COALESCE(p.published_at,v.published_at) AS published_at
  FROM url_aliases a JOIN content_items c ON c.id=a.content_id JOIN versions v ON v.id=c.public_version_id AND v.content_id=c.id
  JOIN public_content p ON p.content_id=c.id AND p.version_id=v.id WHERE a.type=$1 AND a.slug=$2`,[type,slug]);
 const row=rows[0];return row?{id:row.id,contentId:row.content_id,type:row.type,slug:row.slug,title:row.title??'',body:row.body??'',publishedAt:row.published_at}:null;
}
