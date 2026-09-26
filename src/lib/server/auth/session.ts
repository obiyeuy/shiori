import { createHash, randomBytes } from 'node:crypto';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const IDLE_MS = 24 * 60 * 60 * 1000;

export function createSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export async function hashToken(token: string): Promise<string> {
  return createHash('sha256').update(token).digest('hex');
}

export function isSessionFresh(session: { createdAt: Date; lastSeenAt: Date }, now = new Date()): boolean {
  const age = now.getTime() - session.createdAt.getTime();
  const idle = now.getTime() - session.lastSeenAt.getTime();
  return age >= 0 && idle >= 0 && age < MAX_AGE_MS && idle < IDLE_MS;
}

export function verifyCsrf(origin: string | null, trustedOrigin: string | null): boolean {
  if (!origin || !trustedOrigin) return false;
  try {
    return new URL(origin).origin === new URL(trustedOrigin).origin;
  } catch {
    return false;
  }
}

export const sessionPolicy = { maxAgeMs: MAX_AGE_MS, idleMs: IDLE_MS, sameSite: 'lax' as const, httpOnly: true, secure: true };
