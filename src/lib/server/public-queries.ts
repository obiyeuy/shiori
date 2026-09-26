import type {Pool} from 'pg';
import {publicPaths,publicHref,type PublicType,type PublicRow} from '../content/public.js';
export const currentPublic='public_content p JOIN content_items c ON c.id=p.content_id AND c.public_version_id=p.version_id';
export function validatePage(page:number){if(!Number.isSafeInteger(page)||page<1||page>10000)throw new Error('无效页码');return page;}
export async function getHomeData(pool:Pool){
 const results=await Promise.all([
  pool.query<PublicRow>(`SELECT p.*,c.first_published_at,(SELECT max(created_at) FROM publication_events e WHERE e.content_id=c.id AND e.kind IN ('first','important')) update_at FROM ${currentPublic} WHERE p.type IN ('article','note','moment') ORDER BY update_at DESC NULLS LAST,c.first_published_at DESC,c.id LIMIT 6`),
  pool.query<PublicRow>(`SELECT p.*,c.first_published_at FROM ${currentPublic} WHERE p.type='project' ORDER BY c.first_published_at DESC,c.id LIMIT 3`),
  pool.query<PublicRow>(`SELECT p.*,c.first_published_at FROM ${currentPublic} WHERE p.type='tool' ORDER BY c.first_published_at DESC,c.id LIMIT 3`),
  pool.query<PublicRow>(`SELECT p.*,c.first_published_at FROM ${currentPublic} JOIN site_settings s ON s.key='featured-content' JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(s.value)='array' THEN s.value ELSE '[]'::jsonb END) WITH ORDINALITY AS featured(id,position) ON featured.id=c.id::text WHERE p.type IN ('article','note') ORDER BY featured.position LIMIT 3`)
 ]);
 return {updates:results[0].rows,projects:results[1].rows,tools:results[2].rows,featured:results[3].rows};
}
export async function getPublicListing(pool:Pool,type:string,page=1,tagIds:string[]=[]){
 validatePage(page);if(!Object.hasOwn(publicPaths,type))throw new Error('无效内容类型');
 tagIds=[...new Set(tagIds)];
 if(tagIds.length>100||tagIds.some(t=>! /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(t)))throw new Error('无效标签');
 if(tagIds.length&&(await pool.query('SELECT id FROM tags WHERE id=ANY($1::uuid[])',[tagIds])).rowCount!==tagIds.length)throw new Error('无效标签');
 const {rows}=await pool.query(`WITH matching AS (SELECT p.*,c.first_published_at FROM ${currentPublic} WHERE p.type=$1 AND (cardinality($2::uuid[])=0 OR EXISTS(SELECT 1 FROM version_tags vt WHERE vt.version_id=p.version_id AND vt.tag_id=ANY($2))))
 SELECT (SELECT count(*) FROM matching) total,COALESCE((SELECT json_agg(list) FROM (SELECT * FROM matching ORDER BY first_published_at DESC,content_id LIMIT 20 OFFSET $3) list),'[]') items`,[type,tagIds,(page-1)*20]);
 return {items:rows[0].items as PublicRow[],total:Number(rows[0].total),page};
}
export async function getPublicDetail(pool:Pool,type:PublicType,slug:string):Promise<PublicRow|{redirect:string}|null>{
 const r=await pool.query<PublicRow>(`SELECT p.*,c.first_published_at FROM ${currentPublic} WHERE p.type=$1 AND p.slug=$2`,[type,slug]);if(r.rowCount)return r.rows[0];
 const alias=await pool.query(`SELECT p.slug FROM url_aliases a JOIN content_items c ON c.id=a.content_id JOIN public_content p ON p.content_id=c.id AND p.version_id=c.public_version_id WHERE a.type=$1 AND a.slug=$2`,[type,slug]);
 return alias.rowCount?{redirect:publicHref(type,alias.rows[0].slug)}:null;
}
export async function publicTags(pool:Pool){return (await pool.query<{id:string;name:string;count:string}>(`SELECT t.id,t.name,count(*) FROM tags t JOIN version_tags vt ON vt.tag_id=t.id JOIN public_content p ON p.version_id=vt.version_id JOIN content_items c ON c.id=p.content_id AND c.public_version_id=p.version_id GROUP BY t.id ORDER BY t.name`)).rows;}
export async function publicSeries(pool:Pool){return (await pool.query<{id:string;name:string;count:string}>(`SELECT s.id,s.name,count(*) FROM series s JOIN series_members m ON m.series_id=s.id JOIN content_items c ON c.id=m.content_id JOIN public_content p ON p.content_id=c.id AND p.version_id=c.public_version_id WHERE s.status='public' GROUP BY s.id ORDER BY s.name`)).rows;}
export async function publicCollection(pool:Pool,kind:'tag'|'series',id:string,page=1){
 validatePage(page);
 if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id))return null;
 const collection=(await (kind==='tag'?publicTags(pool):publicSeries(pool))).find(t=>t.id===id);if(!collection)return null;
 const join=kind==='tag'?'JOIN version_tags m ON m.version_id=p.version_id WHERE m.tag_id=$1':'JOIN series_members m ON m.content_id=c.id WHERE m.series_id=$1';
 const order=kind==='tag'?'c.first_published_at DESC,c.id':'m.position,c.id';
 const rows=await pool.query<PublicRow>(`SELECT p.*,c.first_published_at FROM ${currentPublic} ${join} ORDER BY ${order} LIMIT 20 OFFSET $2`,[id,(page-1)*20]);
 return {name:collection.name,items:rows.rows,page,total:Number(collection.count)};
}
export type PublicNavigationItem=Pick<PublicRow,'content_id'|'type'|'slug'|'title'|'summary'>;
export type PublicDetailNavigation={series:null|{id:string;name:string;total:number;previous:PublicNavigationItem|null;next:PublicNavigationItem|null};previous:PublicNavigationItem|null;next:PublicNavigationItem|null;related:PublicNavigationItem[]};
export async function publicDetailNavigation(pool:Pool,id:string,type:PublicType):Promise<PublicDetailNavigation>{
 const membership=(await pool.query(`SELECT s.id,s.name FROM series_members m JOIN series s ON s.id=m.series_id WHERE m.content_id=$1 AND s.status='public'`,[id])).rows[0];
 const fields='p.content_id,p.type,p.slug,p.title,p.summary';
 const neighbors=async(join:string,where:string,order:string,params:unknown[])=>{
  const {rows}=await pool.query(`WITH ordered AS (SELECT p.content_id,count(*) OVER() total,lag(jsonb_build_object('content_id',p.content_id,'type',p.type,'slug',p.slug,'title',p.title,'summary',p.summary)) OVER(ORDER BY ${order}) previous,lead(jsonb_build_object('content_id',p.content_id,'type',p.type,'slug',p.slug,'title',p.title,'summary',p.summary)) OVER(ORDER BY ${order}) next FROM ${currentPublic} ${join} WHERE ${where}) SELECT * FROM ordered WHERE content_id=$1`,[id,...params]);
  return rows[0] as {total:string;previous:PublicNavigationItem|null;next:PublicNavigationItem|null}|undefined;
 };
 const sameType=await neighbors('','p.type=$2','c.first_published_at DESC,c.id',[type]);
 const seriesNeighbors=membership?await neighbors('JOIN series_members m ON m.content_id=c.id','m.series_id=$2','m.position,c.id',[membership.id]):undefined;
 const excluded=new Set([id,seriesNeighbors?.previous?.content_id,seriesNeighbors?.next?.content_id]);
 const previous=sameType?.previous&&!excluded.has(sameType.previous.content_id)?sameType.previous:null;
 const next=sameType?.next&&!excluded.has(sameType.next.content_id)?sameType.next:null;
 const related=(await pool.query<PublicNavigationItem>(`SELECT ${fields} FROM ${currentPublic} JOIN version_tags vt ON vt.version_id=p.version_id WHERE p.content_id<>$1 AND vt.tag_id IN (SELECT own.tag_id FROM version_tags own JOIN content_items ci ON ci.public_version_id=own.version_id WHERE ci.id=$1) GROUP BY p.content_id,c.first_published_at ORDER BY count(*) DESC,c.first_published_at DESC,p.content_id LIMIT 3`,[id])).rows;
 return {series:membership&&seriesNeighbors?{id:membership.id,name:membership.name,total:Number(seriesNeighbors.total),previous:seriesNeighbors.previous,next:seriesNeighbors.next}:null,previous,next,related};
}
