import { beforeAll, afterAll, it, expect } from 'vitest';
import type { Pool } from 'pg';
import { testDatabase } from '../helpers/database.js';
import * as limits from '../../src/lib/server/auth/rate-limit.js';
import * as oauth from '../../src/lib/server/auth/oauth.js';
import * as policy from '../../src/lib/server/auth/csrf.js';
let db:Pool;beforeAll(async()=>{db=await testDatabase();});afterAll(async()=>{await db.end();});
it('consumes state exactly once under concurrent callbacks',async()=>{
 const a=await oauth.beginOAuth(db);
 const results=await Promise.allSettled([oauth.consumeOAuth(db,a.state,a.state),oauth.consumeOAuth(db,a.state,a.state)]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
});
it('limits attempts per account and source in the database',async()=>{
 const results=await Promise.all(Array.from({length:8},()=>limits.allowLogin(db,'same-source','owner',5)));
 expect(results.filter(Boolean)).toHaveLength(5);
 expect(await limits.allowLogin(db,'other-source','owner',5)).toBe(false);
});
it('rejects protocol-relative and encoded login return paths',()=>{
 expect(policy.safeReturnPath('//evil.test')).toBe('/workspace');
 expect(policy.safeReturnPath('/%2fevil.test')).toBe('/workspace');
 expect(policy.safeReturnPath('/workspace/content?x=1')).toBe('/workspace/content?x=1');
});
