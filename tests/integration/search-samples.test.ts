import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase} from '../helpers/database.js';
import {ContentRepository} from '../../src/lib/server/content/repository.js';
import {PublicationService} from '../../src/lib/server/publish/service.js';
import {searchPublic} from '../../src/lib/server/search/query.js';
import type {DraftInput} from '../../src/lib/server/content/types.js';
const db=await testDatabase();const repo=new ContentRepository(db);const publish=new PublicationService(db);const tag=randomUUID();const ids:Record<string,string>={};
afterAll(()=>db.end());
beforeAll(async()=>{
 await db.query('INSERT INTO tags(id,name) VALUES($1,$2)',[tag,'数据库']);
 const fixtures:Record<string,DraftInput>={
 A:{type:'article',title:'PostgreSQL 中文搜索',body:'pg_trgm 索引',tags:[tag]},
 B:{type:'note',title:'索引实践',body:'PostgreSQL 中文搜索与 pg_trgm'},
 C:{type:'note',title:'C++ 与 C#',body:'Node.js 100% _ literal'},
 D:{type:'moment',body:'今天给站点增加了搜索'},
 E:{type:'article',title:'草稿唯一词海盐',body:'海盐'},
 F:{type:'article',title:'撤回唯一词琥珀',body:'琥珀'},
 G:{type:'tool',title:'JSON 格式化',description:'检查 JSON 文本',toolStatus:'available',toolUrl:'https://example.com'},
 H:{type:'project',title:'个人站实验',description:'用 SvelteKit 搭建个人站',body:'项目正文',projectStatus:'completed'},
 I:{type:'resource',title:'数据库手册',description:'PostgreSQL 参考资料',sourceName:'手册',sourceUrl:'https://example.com'}
 };
 for(const [label,payload] of Object.entries(fixtures)){
  const id=await repo.createContent(payload.type);ids[label]=id;await repo.saveDraft(id,{...payload,slug:label.toLowerCase()},0);
  if(label!=='E')await publish.publishNow(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null});
 }
 await publish.withdrawPublication(ids.F);
 await db.query("INSERT INTO service_links(id,name,url,status) VALUES($1,'服务唯一词松针','http://localhost','unchecked')",[randomUUID()]);
});
const resultIds=async(q:string,type?:string[],tags?:string[])=>(await searchPublic(db,{q,type,tag:tags})).items.map(x=>x.content_id);
it('S01–S07 literal Chinese/Latin/NFKC/punctuation and title-first ranking',async()=>{
 expect(await resultIds('中文搜索')).toEqual([ids.A,ids.B]);
 expect(new Set(await resultIds('PostgreSQL pg_trgm'))).toEqual(new Set([ids.A,ids.B]));
 expect(new Set(await resultIds('ｐｏｓｔｇｒｅｓｑｌ'))).toEqual(new Set([ids.A,ids.B,ids.I]));
 for(const q of ['C++','C#','Node.js','%','_'])expect(await resultIds(q)).toEqual(q==='_'?expect.arrayContaining([ids.C]):[ids.C]);
 expect(new Set(await resultIds('索'))).toEqual(new Set([ids.A,ids.B,ids.D]));
 expect(new Set(await resultIds('pg_trgm'))).toEqual(new Set([ids.A,ids.B]));
});
it('S08–S13 filters, private isolation and publication changes',async()=>{
 expect(await resultIds('PostgreSQL',['resource'])).toEqual([ids.I]);
 expect(await resultIds('PostgreSQL',[],[tag])).toEqual([ids.A]);
 for(const q of ['海盐','琥珀','松针'])expect(await resultIds(q)).toEqual([]);
 await repo.saveDraft(ids.A,{body:'水杉 pg_trgm'},1);expect(await resultIds('水杉')).toEqual([]);
 await publish.publishNow(ids.A,{key:randomUUID(),revision:2,expectedScheduleRevision:null});expect(await resultIds('水杉')).toEqual([ids.A]);
 expect(await resultIds('JSON')).toEqual([ids.G]);expect(await resultIds('SvelteKit')).toEqual([ids.H]);
});
it('S14–S16 validation, accurate empty-page count, stable pagination and failure distinct from zero',async()=>{
 await expect(searchPublic(db,{q:'a b c d e f g h i'})).rejects.toThrow();
 await expect(searchPublic(db,{q:'x',type:['private']})).rejects.toThrow();
 await expect(searchPublic(db,{q:'x',type:['constructor']})).rejects.toThrow();
 await expect(searchPublic(db,{q:'x',tag:[randomUUID()]})).rejects.toThrow();
 for(let i=0;i<21;i++){const id=await repo.createContent('note');await repo.saveDraft(id,{title:`分页样例 ${i}`,body:'分页样例',slug:`page-${i}`},0);await publish.publishNow(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null});}
 const first=await searchPublic(db,{q:'分页样例'}),second=await searchPublic(db,{q:'分页样例',page:2}),empty=await searchPublic(db,{q:'分页样例',page:3});
 expect(first.total).toBe(21);expect(first.items).toHaveLength(20);expect(second.items).toHaveLength(1);expect(empty.total).toBe(21);
 expect(new Set([...first.items,...second.items].map(x=>x.content_id)).size).toBe(21);
 const {Pool}=await import('pg');const broken=new Pool({connectionString:'postgres://invalid:invalid@127.0.0.1:1/missing',connectionTimeoutMillis:100});
 try{const failure=await searchPublic(broken,{q:'test'});expect(failure.error).toBeTruthy();expect(failure.total).toBeNull();}finally{await broken.end();}
});
