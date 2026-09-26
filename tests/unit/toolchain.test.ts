import { describe, expect, it } from 'vitest';
import { parseRuntimeConfig } from '../../src/lib/server/config.js';

describe('runtime configuration', () => {
  it('rejects a short session secret and accepts a complete local configuration', () => {
    expect(() => parseRuntimeConfig({ DATABASE_URL: 'postgres://db', SESSION_SECRET: 'short' })).toThrow();
    const config = parseRuntimeConfig({
      DATABASE_URL: 'postgres://db',
      SESSION_SECRET: '12345678901234567890123456789012'
    });
    expect(config.databaseUrl).toBe('postgres://db');
    expect(config.sessionCookieName).toBe('personal_site_session');
  });
});
