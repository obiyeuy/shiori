import {it,expect,afterAll} from 'vitest';
import {randomUUID} from 'node:crypto';
import {testDatabase} from '../helpers/database.js';
import {ContentRepository} from '../../src/lib/server/content/repository.js';
import {getCurrentPublicBySlug} from '../helpers/content-fixture.js';
import {PublicationService} from '../../src/lib/server/publish/service.js';
const pool=await testDatabase();afterAll(()=>pool.end());const repo=new ContentRepository(pool);const service=new PublicationService(pool);
it('restarts publish frozen snapshots exactly once and default manual publishing cancels old schedules',async()=>{
 const id=await repo.createContent('note');await repo.saveDraft(id,{title:'t',body:'scheduled',slug:'scheduled'},0);
 const scheduled=await service.createSchedule(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null,runAt:new Date(Date.now()+1000)});
 await repo.saveDraft(id,{body:'unscheduled'},1);
 await Promise.all([service.scanDueSchedules(new Date(Date.now()+5000)),service.scanDueSchedules(new Date(Date.now()+5000))]);
 expect((await getCurrentPublicBySlug(pool,'note','scheduled'))?.body).toBe('scheduled');
 expect((await pool.query('SELECT * FROM publication_events WHERE content_id=$1',[id])).rowCount).toBe(1);
 expect((await pool.query('SELECT status FROM schedules WHERE id=$1',[scheduled.id])).rows[0].status).toBe('completed');
 const next=await service.createSchedule(id,{key:randomUUID(),revision:2,expectedScheduleRevision:null,runAt:new Date(Date.now()+60_000)});
 await service.publishNow(id,{key:randomUUID(),revision:2,expectedScheduleRevision:next.revision});
 expect((await pool.query('SELECT status FROM schedules WHERE id=$1',[next.id])).rows[0].status).toBe('cancelled');
});
it('uses bounded 1/5/15 minute retries for transient faults, then fails without reviving cancellation',async()=>{
 const id=await repo.createContent('note');await repo.saveDraft(id,{title:'t',body:'body',slug:'retry'},0);
 const scheduled=await service.createSchedule(id,{key:randomUUID(),revision:1,expectedScheduleRevision:null,runAt:new Date(Date.now()+1000)});
 // Database fault at the real publication side effect, not a fake publisher.
 await pool.query("CREATE FUNCTION fail_publication() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected transient fault'; END $$; CREATE TRIGGER inject_fault BEFORE INSERT ON publication_events FOR EACH ROW EXECUTE FUNCTION fail_publication()");
 let now=new Date(Date.now()+2000);
 for(const delay of [60_000,300_000,900_000]){
  await service.scanDueSchedules(now);const row=(await pool.query('SELECT * FROM schedules WHERE id=$1',[scheduled.id])).rows[0];
  expect(row.status).toBe('retrying');expect(row.next_attempt_at.getTime()-now.getTime()).toBe(delay);now=new Date(row.next_attempt_at.getTime()+1);
 }
 await service.scanDueSchedules(now);expect((await pool.query('SELECT status,attempts FROM schedules WHERE id=$1',[scheduled.id])).rows[0]).toEqual({status:'failed',attempts:4});
});
