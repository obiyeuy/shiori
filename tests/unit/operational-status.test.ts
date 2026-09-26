import {it,expect} from 'vitest';
import * as status from '../../src/lib/server/operations/status.js';
it('retains last success when latest run failed and uses snapshot time for staleness',()=>{
 const now=new Date('2026-09-26T12:00:00Z');
 const failed=status.summarizeOperation({state:'failure',eventAt:'2026-09-26T10:00:00Z',collectedAt:'2026-09-26T11:59:00Z',lastSuccessAt:'2026-09-25T11:00:00Z',lastFailureAt:'2026-09-26T10:00:00Z'},now);
 expect(failed.state).toBe('failure');expect(failed.lastSuccessAt?.toISOString()).toBe('2026-09-25T11:00:00.000Z');
 expect(status.summarizeOperation({state:'success',eventAt:'2026-09-23T10:00:00Z',collectedAt:now.toISOString(),lastSuccessAt:'2026-09-23T10:00:00Z'},now).state).toBe('stale');
 expect(status.summarizeOperation(null,now).state).toBe('no-record');
 expect(status.summarizeOperation({state:'success',eventAt:'not-a-time'},now).state).toBe('read-failure');
});
