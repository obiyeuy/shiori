import {it,expect,afterAll} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase} from '../helpers/database.js';
import {ContentRepository} from '../../src/lib/server/content/repository.js';
import {PublicationService} from '../../src/lib/server/publish/service.js';
import {getHomeData,getPublicDetail,getPublicListing} from '../../src/lib/server/public-queries.js';
const db=await testDatabase();afterAll(()=>db.end());const repo=new ContentRepository(db);const pub=new PublicationService(db);
it('only current pointers reach home/list/details; aliases use correct type paths and withdrawn pages vanish',async()=>{
 const id=await repo.createContent('resource');await repo.saveDraft(id,{title:'公开资源',slug:'old',description:'描述',sourceName:'来源',sourceUrl:'https://example.com'},0);await pub.publishNow(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null});
 await repo.saveDraft(id,{slug:'new'},1);await pub.publishNow(id,{key:randomUUID(),revision:2,expectedScheduleRevision:null});
 expect(await getPublicDetail(db,'resource','old')).toEqual({redirect:'/resources/new'});
 await pub.withdrawPublication(id);expect(await getPublicDetail(db,'resource','new')).toBeNull();
 // Deliberately stale projection must not grant visibility after withdrawal.
 const v=(await db.query('SELECT * FROM versions WHERE content_id=$1 ORDER BY created_at DESC LIMIT 1',[id])).rows[0];
 await db.query("INSERT INTO public_content(content_id,version_id,type,slug,title,summary,body_text,rendered_html,payload,published_at,rss_id) VALUES($1,$2,'resource','new','stale','s','','',$3,now(),$4)",[id,v.id,v.payload,`urn:uuid:${id}`]);
 expect((await getPublicListing(db,'resource')).items).toHaveLength(0);
});
it('home hides tools only when none public; ordinary revisions do not bump updates',async()=>{
 const a=await repo.createContent('article'),b=await repo.createContent('note');
 for(const [id,type] of [[a,'article'],[b,'note']]){await repo.saveDraft(id,{title:type,slug:type,body:'正文'},0);await pub.publishNow(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null});}
 await repo.saveDraft(a,{body:'普通修订'},1);await pub.publishNow(a,{key:randomUUID(),revision:2,expectedScheduleRevision:null});
 expect((await getHomeData(db)).updates[0].content_id).toBe(b);
 const tool=await repo.createContent('tool');await repo.saveDraft(tool,{title:'维护工具',slug:'tool',description:'用途',toolStatus:'maintenance',unavailableReason:'升级'},0);await pub.publishNow(tool,{key:randomUUID(),revision:1,expectedScheduleRevision:null});
 expect((await getHomeData(db)).tools).toHaveLength(1);
});
it('RSS and sitemap exclude stale, private and withdrawn rows and use stable canonical addresses',async()=>{
 const {rssDocument,sitemapDocument}=await import('../../src/lib/server/public-feed.js');
 const rss=await rssDocument(db,'https://example.com'),sitemap=await sitemapDocument(db,'https://example.com');
 expect(rss).toContain('<guid isPermaLink="false">urn:uuid:');expect(rss).toContain('/articles/article');
 expect(rss).not.toContain('/tools/tool');expect(sitemap).toContain('/tools/tool');expect(sitemap).not.toContain('/resources/new');
});
it('rejects unknown listing tags and paginates public tag and series collections',async()=>{
 await expect(getPublicListing(db,'article',1,[randomUUID()])).rejects.toThrow('无效标签');
 const {publicCollection}=await import('../../src/lib/server/public-queries.js');
 const tag=randomUUID();await db.query('INSERT INTO tags(id,name) VALUES($1,$2)',[tag,'分页标签']);
 for(let i=0;i<21;i++){const id=await repo.createContent('article');await repo.saveDraft(id,{title:`分页 ${i}`,slug:`collection-${i}`,body:'内容',tags:[tag]},0);await pub.publishNow(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null});}
 const first=await publicCollection(db,'tag',tag,1),second=await publicCollection(db,'tag',tag,2);
 expect(first?.items).toHaveLength(20);expect(second?.items).toHaveLength(1);expect(second?.total).toBe(21);
});
it('detail navigation follows public series order and never counts a draft member',async()=>{
 const {publicDetailNavigation}=await import('../../src/lib/server/public-queries.js');
 const series=randomUUID();await db.query("INSERT INTO series(id,name,status) VALUES($1,'公开系列','public')",[series]);
 const ids:string[]=[];
 for(let i=0;i<3;i++){const id=await repo.createContent('note');ids.push(id);await repo.saveDraft(id,{title:`系列 ${i}`,slug:`series-${i}`,body:'系列正文'},0);if(i!==1)await pub.publishNow(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null});await db.query('INSERT INTO series_members(content_id,series_id,position) VALUES($1,$2,$3)',[id,series,i]);}
 const nav=await publicDetailNavigation(db,ids[0],'note');expect(nav.series?.total).toBe(2);expect(nav.series?.next?.content_id).toBe(ids[2]);expect(nav.series?.previous).toBeNull();
 expect(nav.related.some(x=>x.content_id===ids[1])).toBe(false);
});
it('preserves manual featured order and excludes other content types',async()=>{
 const rows=(await db.query("SELECT content_id FROM public_content WHERE type='article' ORDER BY slug LIMIT 2")).rows;
 const ids=rows.map(row=>row.content_id);const tool=(await db.query("SELECT content_id FROM public_content WHERE type='tool' LIMIT 1")).rows[0].content_id;
 await db.query("INSERT INTO site_settings(key,value) VALUES('featured-content',$1)",[JSON.stringify([ids[1],tool,ids[0]])]);
 expect((await getHomeData(db)).featured.map(row=>row.content_id)).toEqual([ids[1],ids[0]]);
 await expect(getPublicListing(db,'constructor')).rejects.toThrow('无效内容类型');
});
