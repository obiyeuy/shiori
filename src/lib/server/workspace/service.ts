import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {transaction} from '../db/transaction.js';
import {audit} from '../audit/events.js';
import type {OwnerContext} from '../auth/service.js';
import {contentTypes} from '../content/types.js';
const uuid=z.string().uuid();
const name=z.string().trim().min(1).max(100);
const safeUrl=z.string().url().max(2048).refine(value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}},'仅允许不含账号密码的 HTTP(S) 地址');
export async function requireWorkspaceSession(db:PoolClient,owner:OwnerContext,recent=false){
 const result=await db.query(`SELECT s.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=$1 AND u.id=$2 AND u.role='owner' AND s.revoked_at IS NULL AND s.created_at>now()-interval '7 days' AND s.last_seen_at>now()-interval '24 hours' AND (NOT $3::boolean OR s.reauthenticated_at>now()-interval '10 minutes') FOR UPDATE OF s`,[owner.sessionId,owner.userId,recent]);
 if(!result.rowCount)throw new Error(recent?'请先重新认证，再执行此操作':'站长会话已失效，请重新登录');
}
export type ContentFilter={type?:string;published?:string;archived?:string;schedule?:string;editing?:string;tags?:string[];q?:string;page?:number};
export type WorkspaceContent={id:string;type:string;archived:boolean;public_version_id:string|null;title:string;revision:number|null;updated_at:Date|null;schedule_status:string|null;schedule_id:string|null;editing:string;first_published_at:string|null;slug:string|null};
export class WorkspaceService{
 constructor(private pool:Pool){}
 async contents(input:ContentFilter={}){
  const filter=z.object({type:z.enum(contentTypes).optional(),published:z.enum(['yes','no']).optional(),archived:z.enum(['yes','no','all']).default('no'),editing:z.enum(['changed','same','draft']).optional(),tags:z.array(uuid).max(100).default([]),q:z.string().max(100).default(''),schedule:z.enum(['pending','running','retrying','failed','none']).optional(),page:z.number().int().min(1).max(10000).default(1)}).parse(input);
  const result=await this.pool.query(`WITH matching AS (SELECT c.*,p.slug,CASE WHEN c.public_version_id IS NULL THEN 'draft' WHEN d.payload IS DISTINCT FROM p.payload THEN 'changed' ELSE 'same' END editing,COALESCE(d.payload->>'title',d.payload->>'body','未命名内容') title,d.revision,d.updated_at,s.status schedule_status,s.id schedule_id FROM content_items c LEFT JOIN drafts d ON d.content_id=c.id LEFT JOIN public_content p ON p.version_id=c.public_version_id LEFT JOIN schedules s ON s.content_id=c.id AND s.status IN ('pending','running','retrying','failed') WHERE ($1::text IS NULL OR c.type=$1) AND ($2::text IS NULL OR (c.public_version_id IS NOT NULL)=($2='yes')) AND ($3::text='all' OR c.archived=($3='yes')) AND ($4::text IS NULL OR s.status=$4 OR ($4='none' AND s.id IS NULL)) AND ($6::text IS NULL OR (CASE WHEN c.public_version_id IS NULL THEN 'draft' WHEN d.payload IS DISTINCT FROM p.payload THEN 'changed' ELSE 'same' END)=$6) AND (cardinality($7::text[])=0 OR d.payload->'tags' ?| $7::text[]) AND ($8::text='' OR strpos(lower(COALESCE(d.payload->>'title','')||' '||COALESCE(d.payload->>'body','')),lower($8))>0)) SELECT (SELECT count(*) FROM matching) total,COALESCE((SELECT json_agg(items) FROM (SELECT * FROM matching ORDER BY (schedule_status='failed') DESC NULLS LAST,(public_version_id IS NULL) DESC,updated_at DESC NULLS LAST,id LIMIT 20 OFFSET $5) items),'[]') items`,[filter.type??null,filter.published??null,filter.archived,filter.schedule??null,(filter.page-1)*20,filter.editing??null,filter.tags,filter.q]);
  return {items:result.rows[0].items as WorkspaceContent[],total:Number(result.rows[0].total),page:filter.page};
 }
 async create(owner:OwnerContext,type:string){
  const valid=z.enum(contentTypes).parse(type);
  return transaction(this.pool,async db=>{await requireWorkspaceSession(db,owner);const id=randomUUID();await db.query('INSERT INTO content_items(id,type) VALUES($1,$2)',[id,valid]);await audit(db,'content.created',{id,type:valid},owner.userId);return id;});
 }
 async archive(owner:OwnerContext,id:string,archived:boolean){
  uuid.parse(id);return transaction(this.pool,async db=>{await requireWorkspaceSession(db,owner);if(!(await db.query('UPDATE content_items SET archived=$2 WHERE id=$1 RETURNING id',[id,archived])).rowCount)throw new Error('内容不存在');await audit(db,archived?'content.archived':'content.unarchived',{id},owner.userId);});
 }
 async saveTag(owner:OwnerContext,input:unknown){
  const value=z.object({id:uuid.optional(),name}).strict().parse(input);
  return transaction(this.pool,async db=>{await requireWorkspaceSession(db,owner);const id=value.id??randomUUID();if(value.id){if(!(await db.query('UPDATE tags SET name=$2 WHERE id=$1 RETURNING id',[id,value.name])).rowCount)throw new Error('标签不存在');}else await db.query('INSERT INTO tags(id,name) VALUES($1,$2)',[id,value.name]);await audit(db,'tag.saved',{id},owner.userId);return id;});
 }
 async saveSeries(owner:OwnerContext,input:unknown){
  const value=z.object({id:uuid.optional(),name,description:z.string().max(2000),cover:uuid.nullable().optional(),status:z.enum(['draft','public']),archived:z.boolean(),members:z.array(uuid).max(1000)}).strict().parse(input);
  if(new Set(value.members).size!==value.members.length)throw new Error('系列成员不能重复');
  return transaction(this.pool,async db=>{
   await requireWorkspaceSession(db,owner);await db.query('SELECT pg_advisory_xact_lock(71624613)');const id=value.id??randomUUID();
   const conflicts=await db.query('SELECT content_id FROM series_members WHERE content_id=ANY($1::uuid[]) AND series_id<>$2',[value.members,id]);if(conflicts.rowCount)throw new Error('内容已属于其他系列，请先在原系列移除');
   const members=await db.query("SELECT id FROM content_items WHERE id=ANY($1::uuid[]) AND type IN ('article','note')",[value.members]);if(members.rowCount!==value.members.length)throw new Error('系列只接受现有文章和笔记');
   if(value.cover){const cover=await db.query("SELECT 1 FROM media_variants WHERE media_key=$1 AND variant='display' AND public_at IS NOT NULL",[value.cover]);if(!cover.rowCount)throw new Error('封面须先具有公开展示授权');}
   if(value.id){if(!(await db.query('UPDATE series SET name=$2,description=$3,cover=$4,status=$5,archived=$6 WHERE id=$1 RETURNING id',[id,value.name,value.description,value.cover??null,value.status,value.archived])).rowCount)throw new Error('系列不存在');}
   else await db.query('INSERT INTO series(id,name,description,cover,status,archived) VALUES($1,$2,$3,$4,$5,$6)',[id,value.name,value.description,value.cover??null,value.status,value.archived]);
   await db.query('DELETE FROM series_members WHERE series_id=$1',[id]);
   for(let index=0;index<value.members.length;index++)await db.query('INSERT INTO series_members(content_id,series_id,position) VALUES($1,$2,$3)',[value.members[index],id,index]);
   await audit(db,'series.saved',{id,members:value.members,status:value.status,archived:value.archived},owner.userId);return id;
  });
 }
 async saveService(owner:OwnerContext,input:unknown){
  const value=z.object({id:uuid.optional(),name,url:safeUrl,status:z.enum(['unchecked','available','maintenance','unavailable'])}).strict().parse(input);
  return transaction(this.pool,async db=>{await requireWorkspaceSession(db,owner);const id=value.id??randomUUID();if(value.id){if(!(await db.query('UPDATE service_links SET name=$2,url=$3,status=$4,status_updated_at=clock_timestamp() WHERE id=$1 RETURNING id',[id,value.name,value.url,value.status])).rowCount)throw new Error('服务不存在');}else await db.query('INSERT INTO service_links(id,name,url,status) VALUES($1,$2,$3,$4)',[id,value.name,value.url,value.status]);await audit(db,'service.saved',{id,status:value.status},owner.userId);return id;});
 }
 async saveSettings(owner:OwnerContext,input:unknown){
  const value=z.object({siteName:name,intro:z.string().max(1000),banner:z.object({desktop:uuid.nullable(),mobile:uuid.nullable(),x:z.number().min(0).max(100),y:z.number().min(0).max(100),credit:z.string().max(200),source:z.union([safeUrl,z.literal('')])}).optional(),grantBanner:z.boolean().default(false),featured:z.array(uuid).max(3),projects:z.array(uuid).max(3),giscus:z.object({enabled:z.boolean(),repo:z.string().regex(/^[\w.-]+\/[\w.-]+$/).optional(),repoId:z.string().regex(/^[\w=-]{1,200}$/).optional(),categoryId:z.string().regex(/^[\w=-]{1,200}$/).optional()}).strict()}).strict().parse(input);
  if(value.giscus.enabled&&(!value.giscus.repo||!value.giscus.repoId||!value.giscus.categoryId))throw new Error('启用评论需要完整配置');
  if(new Set(value.featured).size!==value.featured.length||new Set(value.projects).size!==value.projects.length)throw new Error('首页内容不能重复');
  return transaction(this.pool,async db=>{await requireWorkspaceSession(db,owner,true);
   if(value.banner){for(const key of [...new Set([value.banner.desktop,value.banner.mobile].filter(Boolean))]){const media=(await db.query("SELECT v.public_at FROM media_variants v JOIN media m ON m.key=v.media_key WHERE m.key=$1 AND m.state='ready' AND v.variant='display' FOR UPDATE OF v",[key])).rows[0];if(!media)throw new Error('Banner 图片尚未就绪');if(!media.public_at&&!value.grantBanner)throw new Error('Banner 需要明确公开授权');await db.query("UPDATE media_variants SET public_at=COALESCE(public_at,now()) WHERE media_key=$1 AND variant='display'",[key]);}await db.query("INSERT INTO site_settings(key,value) VALUES('banner',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[JSON.stringify(value.banner)]);}
   for(const [ids,types] of [[value.featured,['article','note']],[value.projects,['project']]] as const){const found=await db.query('SELECT id FROM content_items WHERE id=ANY($1::uuid[]) AND type=ANY($2::text[]) AND public_version_id IS NOT NULL',[ids,types]);if(found.rowCount!==ids.length)throw new Error('首页只能选择对应类型的公开内容');}
   for(const [key,data] of [['identity',{siteName:value.siteName,intro:value.intro}],['featured-content',value.featured],['home-projects',value.projects],['giscus',value.giscus]])await db.query('INSERT INTO site_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value',[key,JSON.stringify(data)]);
   await audit(db,'site.settings.saved',{},owner.userId);
  });
 }
}
