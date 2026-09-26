import {it,expect} from 'vitest';import {randomUUID} from 'node:crypto';import {resolve} from 'node:path';import {mkdir,writeFile} from 'node:fs/promises';import {readStatus,writeStatus} from '../../src/lib/server/backup/status.js';
it('O01–O09 distinguishes stale snapshots, failed jobs, receipts and unreadable status',async()=>{
 const root=resolve('.local/status-tests',randomUUID()),now=new Date('2026-09-27T12:00:00Z');await mkdir(root,{recursive:true});
 expect((await readStatus(undefined,'server-backup',now)).state).toBe('unconfigured');expect((await readStatus(root,'server-backup',now)).state).toBe('no-record');
 await writeStatus(root,'server-backup',{state:'success',eventAt:'2026-09-24T12:00:00Z',collectedAt:'2026-09-27T11:00:00Z'});expect((await readStatus(root,'server-backup',now)).state).toBe('stale');
 await writeStatus(root,'server-backup',{state:'failure',eventAt:'2026-09-27T11:30:00Z',collectedAt:'2026-09-27T11:30:00Z'});const failed=await readStatus(root,'server-backup',now);expect(failed.state).toBe('failure');expect(failed.lastSuccessAt?.toISOString()).toBe('2026-09-24T12:00:00.000Z');
 await writeStatus(root,'giscus-export',{state:'failure',eventAt:'2026-09-27T11:00:00Z',collectedAt:'2026-09-27T11:00:00Z'});expect((await readStatus(root,'giscus-export',now)).state).toBe('failure');
 await writeStatus(root,'mac-receipt',{state:'success',eventAt:'2026-09-27T10:00:00Z',collectedAt:'2026-09-27T11:00:00Z'});await writeStatus(root,'mac-receipt',{state:'success',eventAt:'2026-09-24T10:00:00Z',collectedAt:'2026-09-27T11:30:00Z'});expect((await readStatus(root,'mac-receipt',now)).eventAt?.toISOString()).toBe('2026-09-27T10:00:00.000Z');
 await writeFile(resolve(root,'server-backup',`123-${randomUUID()}.json`),'broken');expect((await readStatus(root,'server-backup',now)).state).toBe('read-failure');
});
