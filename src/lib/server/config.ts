import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default('personal_site_session'),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MEDIA_ROOT: z.string().default('./.local/media'),
  BACKUP_STATUS_ROOT: z.string().default('./.local/backup-status'),
  PUBLIC_SITE_URL: z.string().url().default('http://127.0.0.1:5173'),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_OWNER_ID: z.string().regex(/^\d+$/).optional()
});

export type RuntimeConfig = {
  databaseUrl: string;
  databaseSsl: boolean;
  sessionSecret: string;
  sessionCookieName: string;
  mediaRoot: string;
  backupStatusRoot: string;
  publicSiteUrl: string;
  nodeEnv: 'development' | 'test' | 'production';
  github?: { clientId: string; clientSecret: string; ownerId: string };
};

export function parseRuntimeConfig(input: Record<string, string | undefined>): RuntimeConfig {
  const normalized = Object.fromEntries(Object.entries(input).map(([key,value])=>[key, value === '' ? undefined : value]));
  const parsed = envSchema.parse(normalized);
  const origin = new URL(parsed.PUBLIC_SITE_URL);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('PUBLIC_SITE_URL must be an origin');
  if (parsed.NODE_ENV === 'production' && origin.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) throw new Error('Production requires HTTPS');
  const githubValues = [parsed.GITHUB_CLIENT_ID, parsed.GITHUB_CLIENT_SECRET, parsed.GITHUB_OWNER_ID];
  if (githubValues.some(Boolean) && githubValues.some((value) => !value)) {
    throw new Error('GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and GITHUB_OWNER_ID must be configured together');
  }
  return {
    databaseUrl: parsed.DATABASE_URL,
    databaseSsl: parsed.DATABASE_SSL === 'true',
    sessionSecret: parsed.SESSION_SECRET,
    sessionCookieName: parsed.SESSION_COOKIE_NAME,
    mediaRoot: parsed.MEDIA_ROOT,
    backupStatusRoot: parsed.BACKUP_STATUS_ROOT,
    publicSiteUrl: origin.origin,
    nodeEnv: parsed.NODE_ENV,
    github: parsed.GITHUB_CLIENT_ID && parsed.GITHUB_CLIENT_SECRET && parsed.GITHUB_OWNER_ID
      ? { clientId: parsed.GITHUB_CLIENT_ID, clientSecret: parsed.GITHUB_CLIENT_SECRET, ownerId: parsed.GITHUB_OWNER_ID }
      : undefined
  };
}

export function runtimeConfigFromEnv(): RuntimeConfig {
  return parseRuntimeConfig(process.env);
}
