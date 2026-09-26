import { describe, expect, it } from 'vitest';
import { createSessionToken, hashToken, isSessionFresh, verifyCsrf } from '../../src/lib/server/auth/session.js';

describe('session and request protection', () => {
  it('creates high entropy tokens and stores only their digest', async () => {
    const token = createSessionToken();
    expect(token).toHaveLength(64);
    expect(await hashToken(token)).not.toBe(token);
  });

  it('enforces recent activity and same-origin CSRF checks', () => {
    const now = new Date('2026-09-26T00:00:00Z');
    expect(isSessionFresh({ createdAt: new Date('2026-09-20T00:00:00Z'), lastSeenAt: new Date('2026-09-25T12:00:00Z') }, now)).toBe(true);
    expect(isSessionFresh({ createdAt: new Date('2026-09-10T00:00:00Z'), lastSeenAt: new Date('2026-09-20T00:00:00Z') }, now)).toBe(false);
    expect(verifyCsrf('https://example.com', 'https://example.com/path')).toBe(true);
    expect(verifyCsrf('https://evil.example', 'https://example.com/path')).toBe(false);
  });
});
