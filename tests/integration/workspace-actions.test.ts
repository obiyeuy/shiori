import {it,expect,afterAll} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase} from '../helpers/database.js';
import {initializeOwner,authenticatePassword,resolveSession} from '../../src/lib/server/auth/service.js';
import {ContentRepository} from '../../src/lib/server/content/repository.js';
import {PublicationService} from '../../src/lib/server/publish/service.js';
import {WorkspaceService} from '../../src/lib/server/workspace/service.js';
const db=await testDatabase();afterAll(()=>db.end());
await initializeOwner(db,{password:'workspace-test-password'});const login=await authenticatePassword(db,'workspace-test-password');const owner=(await resolveSession(db,login.token))!;
const workspace=new WorkspaceService(db),repo=new ContentRepository(db),pub=new PublicationService(db);
it('requires a current owner session and audits archive without withdrawing',async()=>{
 const id=await repo.createContent('article');await repo.saveDraft(id,{title:'已公开',slug:'workspace-public',body:'正文'},0);await pub.publishNow(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null});
 await expect(workspace.archive({...owner,sessionId:randomUUID()},id,true)).rejects.toThrow();
 await workspace.archive(owner,id,true);const row=(await db.query('SELECT * FROM content_items WHERE id=$1',[id])).rows[0];expect(row.archived).toBe(true);expect(row.public_version_id).toBeTruthy();
 expect((await db.query("SELECT * FROM audit_events WHERE action='content.archived' AND user_id=$1",[owner.userId])).rowCount).toBe(1);
});
it('lists twenty rows with combined state filters and retains accurate total',async()=>{
 for(let i=0;i<21;i++){const id=await repo.createContent('note');await repo.saveDraft(id,{title:`稿件${i}`},0);}
 const first=await workspace.contents({type:'note',published:'no',archived:'no',page:1}),second=await workspace.contents({type:'note',published:'no',archived:'no',page:2});
 expect(first.total).toBe(21);expect(first.items).toHaveLength(20);expect(second.items).toHaveLength(1);
});
it('renames current tags, saves explicit series order and refuses cross-series reassignment',async()=>{
 const tag=await workspace.saveTag(owner,{name:'旧标签'});await workspace.saveTag(owner,{id:tag,name:'新标签'});expect((await db.query('SELECT name FROM tags WHERE id=$1',[tag])).rows[0].name).toBe('新标签');
 const ids=(await db.query("SELECT id FROM content_items WHERE type='note' ORDER BY id LIMIT 2")).rows.map(x=>x.id);
 const a=await workspace.saveSeries(owner,{name:'系列甲',description:'说明',status:'public',archived:false,members:ids}),b=await workspace.saveSeries(owner,{name:'系列乙',description:'',status:'draft',archived:false,members:[]});
 await expect(workspace.saveSeries(owner,{id:b,name:'系列乙',description:'',status:'draft',archived:false,members:[ids[0]]})).rejects.toThrow('其他系列');
 await workspace.saveSeries(owner,{id:a,name:'系列甲',description:'说明',status:'public',archived:false,members:[...ids].reverse()});
 expect((await db.query('SELECT content_id FROM series_members WHERE series_id=$1 ORDER BY position',[a])).rows.map(x=>x.content_id)).toEqual([...ids].reverse());
});
it('updates manual service timestamps without probing, and requires reauthentication for settings',async()=>{
 const id=await workspace.saveService(owner,{name:'本地服务',url:'http://127.0.0.1:9000',status:'unchecked'});
 await workspace.saveService(owner,{id,name:'本地服务',url:'http://127.0.0.1:9000',status:'maintenance'});
 const service=(await db.query('SELECT * FROM service_links WHERE id=$1',[id])).rows[0];expect(service.status).toBe('maintenance');expect(service.status_updated_at).toBeInstanceOf(Date);
 await db.query("UPDATE sessions SET reauthenticated_at=now()-interval '11 minutes' WHERE id=$1",[owner.sessionId]);
 await expect(workspace.saveSettings(owner,{siteName:'个人站',intro:'介绍',featured:[],projects:[],giscus:{enabled:false}})).rejects.toThrow('重新认证');
 await db.query('UPDATE sessions SET reauthenticated_at=now() WHERE id=$1',[owner.sessionId]);await workspace.saveSettings(owner,{siteName:'个人站',intro:'介绍',featured:[],projects:[],giscus:{enabled:false}});
 expect((await db.query("SELECT value FROM site_settings WHERE key='identity'")).rows[0].value.siteName).toBe('个人站');
});
it('bind OAuth attempts to the initiating owner session and rejects revoked authorization',async()=>{
 const {beginOAuth}=await import('../../src/lib/server/auth/oauth.js');const {hashToken}=await import('../../src/lib/server/auth/session.js');
 const attempt=await beginOAuth(db,owner.sessionId);expect((await db.query('SELECT binding_session_id FROM oauth_attempts WHERE state_digest=$1',[await hashToken(attempt.state)])).rows[0].binding_session_id).toBe(owner.sessionId);
 const temporary=await authenticatePassword(db,'workspace-test-password');const session=(await resolveSession(db,temporary.token))!;await db.query('UPDATE sessions SET revoked_at=now() WHERE id=$1',[session.sessionId]);
 await expect(workspace.saveTag(session,{name:'不得写入'})).rejects.toThrow('失效');
});
it('hides archived by default and exposes draft edits and OR-tag filtering',async()=>{
 const id=await repo.createContent('article');const a=await workspace.saveTag(owner,{name:'筛选A'}),b=await workspace.saveTag(owner,{name:'筛选B'});
 await repo.saveDraft(id,{title:'组合紫藤',slug:'filter-test',body:'原版',tags:[a]},0);await pub.publishNow(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null});
 expect((await workspace.contents({editing:'same',tags:[a,b],q:'紫藤'})).items.map(row=>row.id)).toEqual([id]);
 await repo.saveDraft(id,{body:'新版'},1);expect((await workspace.contents({editing:'changed',tags:[b,a]})).items.map(row=>row.id)).toContain(id);
 await workspace.archive(owner,id,true);expect((await workspace.contents({q:'紫藤'})).total).toBe(0);expect((await workspace.contents({q:'紫藤',archived:'all'})).total).toBe(1);
});
it('publishes series metadata but hides draft series and exposes actionable overview records',async()=>{
 const {publicCollection}=await import('../../src/lib/server/public-queries.js');const {getWorkspaceOverview}=await import('../../src/lib/server/workspace/overview.js');
 const id=await repo.createContent('note');await repo.saveDraft(id,{title:'系列元信息',slug:'series-metadata',body:'正文'},0);await pub.publishNow(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null});
 const series=await workspace.saveSeries(owner,{name:'公开元信息',description:'可读简介',status:'draft',archived:false,members:[id]});expect(await publicCollection(db,'series',series)).toBeNull();
 await workspace.saveSeries(owner,{id:series,name:'公开元信息',description:'可读简介',status:'public',archived:false,members:[id]});expect((await publicCollection(db,'series',series))?.description).toBe('可读简介');
 const overview=await getWorkspaceOverview(db);expect(overview.drafts.length).toBeGreaterThan(0);expect(overview.services.length).toBeGreaterThan(0);expect(overview.storage.state).toBe('unconfigured');
});
it('requires explicit authorization before site banner grants a public display variant',async()=>{
 const key=randomUUID();await db.query("INSERT INTO media(key,name,mime,bytes,state) VALUES($1,'banner','image/webp',1,'ready')",[key]);await db.query("INSERT INTO media_variants(media_key,variant,file_key,mime,bytes) VALUES($1,'display',$2,'image/webp',1)",[key,key+'.webp']);
 const input={siteName:'站点',intro:'介绍',featured:[],projects:[],giscus:{enabled:false},banner:{desktop:key,mobile:null,x:50,y:50,credit:'作者',source:'https://example.com'},grantBanner:false};
 await expect(workspace.saveSettings(owner,input)).rejects.toThrow('公开授权');
 await workspace.saveSettings(owner,{...input,grantBanner:true});expect((await db.query("SELECT public_at FROM media_variants WHERE media_key=$1 AND variant='display'",[key])).rows[0].public_at).toBeInstanceOf(Date);
});
