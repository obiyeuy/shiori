import {it,expect,afterAll} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase} from '../helpers/database.js';
import {ContentRepository} from '../../src/lib/server/content/repository.js';
import {PublicationService} from '../../src/lib/server/publish/service.js';
const pool=await testDatabase();afterAll(()=>pool.end());const repo=new ContentRepository(pool);const service=new PublicationService(pool);
async function draft(slug:string){const id=await repo.createContent('article');await repo.saveDraft(id,{title:'Title',body:'body',slug},0);return id;}
it('publishes once by idempotency key, keeps RSS identity and rejects changed confirmation',async()=>{
 const id=await draft('one');const options={key:randomUUID(),revision:1,expectedScheduleRevision:null};
 const [a,b]=await Promise.all([service.publishNow(id,options),service.publishNow(id,options)]);
 expect(a.versionId).toBe(b.versionId);expect((await pool.query('SELECT * FROM publication_events WHERE content_id=$1',[id])).rowCount).toBe(1);
 await repo.saveDraft(id,{body:'new',slug:'two'},1);
 await expect(service.publishNow(id,{...options,key:randomUUID()})).rejects.toThrow(/修订/);
 const second=await service.publishNow(id,{...options,key:randomUUID(),revision:2,important:true});expect(second.rssId).toBe(a.rssId);
 expect((await repo.getPublicVersionBySlug('article','one'))?.slug).toBe('two');
 expect((await pool.query("SELECT * FROM publication_events WHERE content_id=$1 AND kind='important'",[id])).rowCount).toBe(1);
});
it('preflight blocks missing references and rollback preserves the old public version',async()=>{
 const id=await draft('safe');const first=await service.publishNow(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null});
 await repo.saveDraft(id,{body:'![missing](media:01234567-89ab-4def-8123-456789abcdef)'},1);
 expect((await service.runPreflight(id,2)).ok).toBe(false);
 await expect(service.publishNow(id,{key:randomUUID(),revision:2,expectedScheduleRevision:null})).rejects.toThrow();
 expect((await pool.query('SELECT public_version_id FROM content_items WHERE id=$1',[id])).rows[0].public_version_id).toBe(first.versionId);
});
it('explicit schedule preservation and withdrawal are atomic with worker races',async()=>{
 const id=await draft('race');const schedule=await service.createSchedule(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null,runAt:new Date(Date.now()+60_000)});
 await repo.saveDraft(id,{body:'manual new'},1);
 await service.publishNow(id,{key:randomUUID(),revision:2,expectedScheduleRevision:1,keepSchedule:true});
 expect((await pool.query('SELECT status FROM schedules WHERE id=$1',[schedule.id])).rows[0].status).toBe('pending');
 await Promise.all([service.scanDueSchedules(new Date(Date.now()+120_000)),service.withdrawPublication(id)]);
 expect((await pool.query('SELECT public_version_id FROM content_items WHERE id=$1',[id])).rows[0].public_version_id).toBeNull();
 await service.scanDueSchedules(new Date(Date.now()+240_000));
 expect((await pool.query('SELECT * FROM public_content WHERE content_id=$1',[id])).rowCount).toBe(0);
});
it('cannot cancel a replacement schedule using confirmation from an older schedule',async()=>{
 const id=await draft('schedule-replacement');const first=await service.createSchedule(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null,runAt:new Date(Date.now()+60_000)});
 await service.updateSchedule(first.id,first.revision,'cancel');
 await service.createSchedule(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null,runAt:new Date(Date.now()+120_000)});
 await expect(service.publishNow(id,{key:randomUUID(),revision:1,expectedScheduleRevision:first.revision})).rejects.toThrow(/排期状态/);
});
