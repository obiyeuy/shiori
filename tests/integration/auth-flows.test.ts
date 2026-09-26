import { testDatabase } from '../helpers/database.js';
import { describe, expect, it } from 'vitest';
import { initializeOwner, authenticatePassword, revokeSession, bindGithubOwner } from '../../src/lib/server/auth/service.js';

async function setup() { return {pool:await testDatabase()}; }

describe('owner authentication', () => {
  it('allows exactly one owner and revocable sessions', async () => {
    const { pool } = await setup();
    await initializeOwner(pool, { password: 'long-enough-password', githubNumericId: '123' });
    await expect(initializeOwner(pool, { password: 'another-long-password' })).rejects.toThrow(/already exists/);
    const session = await authenticatePassword(pool, 'long-enough-password');
    expect(session.token).toHaveLength(64);
    await revokeSession(pool, session.sessionId);
    await expect(authenticatePassword(pool, 'wrong-password')).rejects.toThrow(/invalid credentials/);
    await pool.end();
  });

  it('rejects a GitHub identity that is not the configured owner identity', async () => {
    const { pool } = await setup();
    await initializeOwner(pool, { password: 'long-enough-password', githubNumericId: '123' });
    await expect(bindGithubOwner(pool, '999', '123')).rejects.toThrow(/does not match/);
    await pool.end();
  });
});
