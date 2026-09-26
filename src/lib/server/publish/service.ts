import {recordReferences} from '../media/references.js';
import {randomUUID,createHash} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {transaction} from '../db/transaction.js';
import {validateDraft} from '../content/validation.js';
import type {DraftInput} from '../content/types.js';
import {renderMarkdown,type RenderedDocument,type MediaReference} from '../markdown/render.js';
import {MediaService} from '../media/service.js';
import {audit} from '../audit/events.js';
export type PublishOptions={key:string;revision:number;expectedScheduleRevision:number|null;keepSchedule?:boolean;important?:boolean};
export type PublicationResult={versionId:string;rssId:string;publishedAt:string;url:string;schedule:'kept'|'cancelled'|'none'};
export type PreflightResult={ok:boolean;errors:{field:string;message:string}[];summary:string;document:RenderedDocument;media:MediaReference[];alreadyPublic:string[]};
export class PreflightError extends Error{}
const open="status IN ('pending','running','retrying','failed')";
const paths={article:'articles',note:'notes',moment:'moments',project:'projects',tool:'tools',resource:'resources'};
export class PublicationService{
 constructor(private pool:Pool,private mediaRoot=process.env.MEDIA_ROOT??''){}
 private async lock(c:PoolClient,id:string){const r=(await c.query('SELECT * FROM content_items WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!r)throw new Error('内容不存在');return r;}
 private async active(c:PoolClient,id:string){return (await c.query(`SELECT * FROM schedules WHERE content_id=$1 AND ${open} FOR UPDATE`,[id])).rows[0]??null;}
 private async confirm(c:PoolClient,id:string,expected:number|null){const s=await this.active(c,id);if((s?.revision??null)!==expected)throw new PreflightError('排期状态已变化，请重新核对');return s;}
 private async draft(c:PoolClient,id:string,revision:number){const r=(await c.query('SELECT * FROM drafts WHERE content_id=$1',[id])).rows[0];if(!r||r.revision!==revision)throw new PreflightError('修订已变化，请重新核对');return r.payload as DraftInput;}
 private async preflight(c:PoolClient,id:string,payload:DraftInput):Promise<PreflightResult>{
  const validation=validateDraft(payload,'publish');const errors=[...validation.errors];
  const document=await renderMarkdown(payload.body??'','public');
  if(['article','note','moment','project'].includes(payload.type)&&!document.hasContent)errors.push({field:'body',message:'正文没有可渲染内容'});
  for(const reference of document.unresolved)errors.push({field:'body',message:`未解析的媒体引用：${reference}`});
  const reserved=await c.query('SELECT content_id FROM url_aliases WHERE type=$1 AND slug=$2',[payload.type,payload.slug]);
  if(reserved.rowCount&&reserved.rows[0].content_id!==id)errors.push({field:'slug',message:'地址已被当前或历史内容使用'});
  const media=[...document.media,...(payload.cover?[{key:payload.cover,variant:'display' as const,description:'封面'}]:[]),...(payload.gallery??[]).map(key=>({key,variant:'display' as const,description:'作品图'}))];
  const alreadyPublic:string[]=[];
  for(const ref of media){
   const row=(await c.query('SELECT m.state,v.public_at FROM media m LEFT JOIN media_variants v ON v.media_key=m.key AND v.variant=$2 WHERE m.key=$1',[ref.key,ref.variant])).rows[0];
   if(!row||row.state!=='ready'){errors.push({field:'body',message:`媒体 ${ref.key} 尚未就绪`});continue;}
   if(!ref.description.trim())errors.push({field:'body',message:'图片需要描述；装饰图请明确填写“装饰图”'});
   try{await new MediaService(this.pool,this.mediaRoot).authorizeMedia(true,ref.key,ref.variant,c);}catch{errors.push({field:'body',message:`媒体 ${ref.key} 指定文件不可读取；动画或附件请明确选择原文件公开`});}
   if(row.public_at)alreadyPublic.push(ref.key);
  }
  for(const tag of payload.tags??[])if(!(await c.query('SELECT id FROM tags WHERE id=$1',[tag])).rowCount)errors.push({field:'tags',message:'标签不存在'});
  const summary=payload.summary?.trim()||payload.description?.trim()||[...document.text].slice(0,160).join('');
  return {ok:!errors.length,errors,summary,document,media,alreadyPublic};
 }
 async runPreflight(id:string,revision:number){return transaction(this.pool,async c=>{await this.lock(c,id);return this.preflight(c,id,await this.draft(c,id,revision));});}
 private fingerprint(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
 private async replay(c:PoolClient,id:string,key:string,fingerprint:string){
  if(!/^[0-9a-f-]{36}$/.test(key))throw new PreflightError('无效操作键');
  const row=(await c.query('SELECT * FROM publication_operations WHERE key=$1',[key])).rows[0];
  if(row&&(row.content_id!==id||row.fingerprint!==fingerprint))throw new PreflightError('操作键已用于不同请求');return row?.result;
 }
 private async remember(c:PoolClient,id:string,key:string,fingerprint:string,result:unknown){await c.query('INSERT INTO publication_operations(key,content_id,fingerprint,result) VALUES($1,$2,$3,$4)',[key,id,fingerprint,result]);}
 async operationResult(id:string,key:string){return (await this.pool.query('SELECT result FROM publication_operations WHERE key=$1 AND content_id=$2',[key,id])).rows[0]?.result??null;}
 private async snapshot(c:PoolClient,id:string,revision:number,payload:DraftInput,source:string){const version=randomUUID();await c.query('INSERT INTO versions(id,content_id,revision,payload,published_at,source) VALUES($1,$2,$3,$4,clock_timestamp(),$5)',[version,id,revision,payload,source]);await recordReferences(c,id,payload,revision,version);return version;}
 private async publishVersion(c:PoolClient,id:string,versionId:string,payload:DraftInput,important:boolean,preflight:PreflightResult):Promise<PublicationResult>{
  if(!preflight.ok)throw new PreflightError(preflight.errors.map(e=>e.message).join('；'));
  const owner=await c.query('INSERT INTO url_aliases(content_id,type,slug) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING content_id',[id,payload.type,payload.slug]);
  if(!owner.rowCount&&(await c.query('SELECT content_id FROM url_aliases WHERE type=$1 AND slug=$2',[payload.type,payload.slug])).rows[0]?.content_id!==id)throw new PreflightError('slug 已占用');
  const now=new Date();const first=!(await c.query('SELECT first_published_at FROM content_items WHERE id=$1',[id])).rows[0].first_published_at;
  await c.query('UPDATE content_items SET public_version_id=$2,first_published_at=COALESCE(first_published_at,$3) WHERE id=$1',[id,versionId,now]);
  const rssId=`urn:uuid:${id}`;
  await c.query(`INSERT INTO public_content(content_id,version_id,type,slug,title,summary,body_text,rendered_html,payload,published_at,rss_id)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(content_id) DO UPDATE SET version_id=excluded.version_id,slug=excluded.slug,title=excluded.title,summary=excluded.summary,body_text=excluded.body_text,rendered_html=excluded.rendered_html,payload=excluded.payload,published_at=excluded.published_at`,
   [id,versionId,payload.type,payload.slug,payload.title??'',preflight.summary,preflight.document.text,preflight.document.html,payload,now,rssId]);
  for(const ref of preflight.media){await c.query('UPDATE media_variants SET public_at=COALESCE(public_at,$3) WHERE media_key=$1 AND variant=$2',[ref.key,ref.variant,now]);}
  for(const tag of payload.tags??[])await c.query('INSERT INTO version_tags(version_id,tag_id,name_snapshot) SELECT $1,id,name FROM tags WHERE id=$2 ON CONFLICT DO NOTHING',[versionId,tag]);
  await c.query('INSERT INTO publication_events(id,content_id,version_id,kind) VALUES($1,$2,$3,$4)',[randomUUID(),id,versionId,first?'first':important?'important':'revision']);
  await audit(c,'content.publish',{contentId:id,versionId,important});
  return {versionId,rssId,publishedAt:now.toISOString(),url:`/${paths[payload.type]}/${payload.slug}`,schedule:'none'};
 }
 async publishNow(id:string,options:PublishOptions):Promise<PublicationResult>{
  return transaction(this.pool,async c=>{
   await this.lock(c,id);const hash=this.fingerprint({action:'publish',...options});const old=await this.replay(c,id,options.key,hash);if(old)return old;
   const schedule=await this.confirm(c,id,options.expectedScheduleRevision);const payload=await this.draft(c,id,options.revision);const pf=await this.preflight(c,id,payload);if(!pf.ok)throw new PreflightError(pf.errors.map(e=>e.message).join('；'));
   const version=await this.snapshot(c,id,options.revision,payload,'publish');const result=await this.publishVersion(c,id,version,payload,!!options.important,pf);
   if(schedule){result.schedule=options.keepSchedule?'kept':'cancelled';if(!options.keepSchedule)await c.query("UPDATE schedules SET status='cancelled',revision=revision+1 WHERE id=$1",[schedule.id]);}
   await this.remember(c,id,options.key,hash,result);return result;
  });
 }
 async createSchedule(id:string,options:PublishOptions&{runAt:Date}):Promise<{id:string;revision:number}>{
  return transaction(this.pool,async c=>{
   await this.lock(c,id);const hash=this.fingerprint({action:'schedule',...options});const old=await this.replay(c,id,options.key,hash);if(old)return old;
   if(!Number.isFinite(options.runAt.getTime())||options.runAt.getTime()<=Date.now())throw new PreflightError('排期必须晚于当前时间');
   const existing=await this.confirm(c,id,options.expectedScheduleRevision);if(existing)throw new PreflightError('已有排期，请使用更新版本或修改时间');
   const payload=await this.draft(c,id,options.revision);const pf=await this.preflight(c,id,payload);if(!pf.ok)throw new PreflightError(pf.errors.map(e=>e.message).join('；'));
   const version=await this.snapshot(c,id,options.revision,payload,'schedule');const schedule=randomUUID();
   const scheduleRevision=Number((await c.query('SELECT COALESCE(max(revision),0)+1 AS next FROM schedules WHERE content_id=$1',[id])).rows[0].next);
   await c.query("INSERT INTO schedules(id,content_id,version_id,status,run_at,important,revision) VALUES($1,$2,$3,'pending',$4,$5,$6)",[schedule,id,version,options.runAt,!!options.important,scheduleRevision]);
   await audit(c,'schedule.create',{contentId:id,scheduleId:schedule});const result={id:schedule,revision:scheduleRevision};await this.remember(c,id,options.key,hash,result);return result;
  });
 }
 async withdrawPublication(id:string){return transaction(this.pool,async c=>{await this.lock(c,id);await c.query('UPDATE content_items SET public_version_id=NULL WHERE id=$1',[id]);await c.query('DELETE FROM public_content WHERE content_id=$1',[id]);await c.query(`UPDATE schedules SET status='cancelled',revision=revision+1 WHERE content_id=$1 AND ${open}`,[id]);await audit(c,'content.withdraw',{contentId:id});});}
 async updateSchedule(scheduleId:string,revision:number,action:'cancel'|'retry'|'time'|'version',value?:Date|number){
  const info=(await this.pool.query('SELECT content_id FROM schedules WHERE id=$1',[scheduleId])).rows[0];if(!info)throw new PreflightError('排期不存在');
  return transaction(this.pool,async c=>{
   await this.lock(c,info.content_id);const s=(await c.query('SELECT * FROM schedules WHERE id=$1 FOR UPDATE',[scheduleId])).rows[0];
   if(s.revision!==revision||['completed','cancelled'].includes(s.status))throw new PreflightError('排期已变化或已结束');
   let version=s.version_id;let runAt=s.run_at;
   if(action==='time'){if(!(value instanceof Date)||value.getTime()<=Date.now())throw new PreflightError('时间必须晚于当前时间');runAt=value;}
   if(action==='version'){const payload=await this.draft(c,info.content_id,Number(value));const pf=await this.preflight(c,info.content_id,payload);if(!pf.ok)throw new PreflightError(pf.errors.map(e=>e.message).join('；'));version=await this.snapshot(c,info.content_id,Number(value),payload,'schedule');}
   await c.query('UPDATE schedules SET status=$2,version_id=$3,run_at=$4,revision=revision+1,attempts=0,next_attempt_at=NULL,last_error=NULL WHERE id=$1',[scheduleId,action==='cancel'?'cancelled':'pending',version,runAt]);await audit(c,`schedule.${action}`,{scheduleId});return {revision:revision+1};
  });
 }
 async scanDueSchedules(now=new Date()){
  const candidates=(await this.pool.query("SELECT id,content_id,revision FROM schedules WHERE status IN ('pending','retrying','running') AND COALESCE(next_attempt_at,run_at)<=$1 ORDER BY run_at LIMIT 100",[now])).rows;
  let completed=0;let failed=0;
  for(const item of candidates){
   try{const did=await transaction(this.pool,async c=>{
    await this.lock(c,item.content_id);const s=(await c.query('SELECT * FROM schedules WHERE id=$1 FOR UPDATE',[item.id])).rows[0];
    if(!['pending','retrying','running'].includes(s.status)||s.revision!==item.revision||new Date(s.next_attempt_at??s.run_at)>now)return false;
    const payload=(await c.query('SELECT payload FROM versions WHERE id=$1',[s.version_id])).rows[0].payload;
    const pf=await this.preflight(c,item.content_id,payload);const result=await this.publishVersion(c,item.content_id,s.version_id,payload,s.important,pf);
    await c.query("UPDATE schedules SET status='completed',revision=revision+1,last_error=NULL WHERE id=$1",[s.id]);
    await this.remember(c,item.content_id,s.id,this.fingerprint({schedule:s.id,revision:s.revision}),result);return true;
   });if(did)completed++;}
   catch(e){failed++;await transaction(this.pool,async c=>{
    await this.lock(c,item.content_id);const s=(await c.query('SELECT * FROM schedules WHERE id=$1 FOR UPDATE',[item.id])).rows[0];
    if(s.revision!==item.revision||!['pending','retrying','running'].includes(s.status))return;
    const attempts=s.attempts+1;const terminal=e instanceof PreflightError||attempts>3;
    const next=terminal?null:new Date(now.getTime()+[60_000,300_000,900_000][attempts-1]);
    await c.query('UPDATE schedules SET status=$2,attempts=$3,next_attempt_at=$4,last_error=$5,revision=revision+1 WHERE id=$1',[s.id,terminal?'failed':'retrying',attempts,next,e instanceof PreflightError?e.message:'发布遇到暂时故障，保留旧公开版']);
    await audit(c,'schedule.failure',{scheduleId:s.id,attempts,terminal});
   });}
  }
  await this.pool.query(`INSERT INTO operation_status(key,event_at,collected_at,last_success_at,state,detail) VALUES('schedule-scan',$1,now(),$1,'success',$2)
   ON CONFLICT(key) DO UPDATE SET event_at=excluded.event_at,collected_at=excluded.collected_at,last_success_at=excluded.last_success_at,state=excluded.state,detail=excluded.detail`,[now,{completed,failed}]);
  return {completed,failed};
 }
}
