import { beforeAll, afterAll, it, expect } from 'vitest';
import type { Pool } from 'pg';
import { testDatabase } from '../helpers/database.js';
import { initializeOwner, authenticatePassword, revokeSession } from '../../src/lib/server/auth/service.js';
import * as auth from '../../src/lib/server/auth/service.js';
import * as oauth from '../../src/lib/server/auth/oauth.js';
import { hashToken } from '../../src/lib/server/auth/session.js';
let db:Pool;
beforeAll(async()=>{db=await testDatabase();await initializeOwner(db,{password:'owner-password-for-test',githubNumericId:'123'});});
afterAll(async()=>{await db.end();});
it('validates, touches and revokes real stored sessions',async()=>{
 const session=await authenticatePassword(db,'owner-password-for-test');
 const saved=(await db.query('select token_digest from sessions where id=$1',[session.sessionId])).rows[0];
 expect(saved.token_digest).toBe(await hashToken(session.token));
 expect(await auth.resolveSession(db,session.token)).toMatchObject({sessionId:session.sessionId});
 await revokeSession(db,session.sessionId);
 expect(await auth.resolveSession(db,session.token)).toBeNull();
});
it('requires recent reauthentication and invalidates other sessions after password change',async()=>{
 const a=await authenticatePassword(db,'owner-password-for-test');const b=await authenticatePassword(db,'owner-password-for-test');
 const owner=await auth.resolveSession(db,a.token);
 await db.query("update sessions set reauthenticated_at=now()-interval '11 minutes' where id=$1",[a.sessionId]);
 await expect(auth.changePassword(db,owner!,'new-owner-password-for-test')).rejects.toThrow();
 await auth.reauthenticate(db,owner!,'owner-password-for-test');
 await auth.changePassword(db,owner!,'new-owner-password-for-test');
 expect(await auth.resolveSession(db,b.token)).toBeNull();
 await expect(authenticatePassword(db,'owner-password-for-test')).rejects.toThrow();
});
it('consumes OAuth state once, rejects mismatch, expiry and unbound identity',async()=>{
 const attempt=await oauth.beginOAuth(db);
 await expect(oauth.consumeOAuth(db,attempt.state,'wrong')).rejects.toThrow();
 expect(await oauth.consumeOAuth(db,attempt.state,attempt.state)).toBeTruthy();
 await expect(oauth.consumeOAuth(db,attempt.state,attempt.state)).rejects.toThrow();
 const expired=await oauth.beginOAuth(db);
 await db.query("update oauth_attempts set expires_at=now()-interval '1 second' where state_digest=$1",[await hashToken(expired.state)]);
 await expect(oauth.consumeOAuth(db,expired.state,expired.state)).rejects.toThrow();
 await expect(auth.authenticateGithub(db,'999','123')).rejects.toThrow();
 const session=await auth.authenticateGithub(db,'123','123');
 expect(await auth.resolveSession(db,session.token)).not.toBeNull();
});
it('does not spuriously log out an older request waiting behind a newer session touch',async()=>{
 const session=await authenticatePassword(db,'new-owner-password-for-test');
 const lock=await db.connect();
 try{
  await lock.query('BEGIN');await lock.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE',[session.sessionId]);
  const pending=auth.resolveSession(db,session.token);
  await new Promise(r=>setTimeout(r,80));
  await lock.query('UPDATE sessions SET last_seen_at=clock_timestamp() WHERE id=$1',[session.sessionId]);await lock.query('COMMIT');
  expect(await pending).not.toBeNull();
 }finally{await lock.query('ROLLBACK');lock.release();}
});
