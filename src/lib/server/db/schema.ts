import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
// SQL migrations are authoritative for deferred constraints and immutable-row triggers.
const time=(name:string)=>timestamp(name,{withTimezone:true});
export const contentItems=pgTable('content_items',{
 id:uuid('id').primaryKey(),type:text('type').notNull(),archived:boolean('archived').notNull().default(false),publicVersionId:uuid('public_version_id'),firstPublishedAt:time('first_published_at')
},t=>[unique().on(t.id,t.type),check('content_type',sql`${t.type} in ('article','note','moment','project','tool','resource')`)]);
export const drafts=pgTable('drafts',{id:uuid('id').primaryKey(),contentId:uuid('content_id').notNull().unique().references(()=>contentItems.id),revision:integer('revision').notNull(),payload:jsonb('payload').notNull()});
export const versions=pgTable('versions',{id:uuid('id').primaryKey(),contentId:uuid('content_id').notNull().references(()=>contentItems.id),revision:integer('revision').notNull(),payload:jsonb('payload').notNull(),publishedAt:time('published_at').notNull()},t=>[unique().on(t.contentId,t.id)]);
export const urlAliases=pgTable('url_aliases',{contentId:uuid('content_id').notNull(),type:text('type').notNull(),slug:text('slug').notNull()},t=>[primaryKey({columns:[t.type,t.slug]}),foreignKey({columns:[t.contentId,t.type],foreignColumns:[contentItems.id,contentItems.type]})]);
export const tags=pgTable('tags',{id:uuid('id').primaryKey(),name:text('name').notNull().unique()});
export const series=pgTable('series',{id:uuid('id').primaryKey(),name:text('name').notNull().unique(),archived:boolean('archived').notNull().default(false),status:text('status').notNull().default('draft')});
export const seriesMembers=pgTable('series_members',{contentId:uuid('content_id').primaryKey().references(()=>contentItems.id),seriesId:uuid('series_id').notNull().references(()=>series.id),position:integer('position').notNull()},t=>[unique().on(t.seriesId,t.position)]);
export const versionTags=pgTable('version_tags',{versionId:uuid('version_id').notNull().references(()=>versions.id),tagId:uuid('tag_id').notNull().references(()=>tags.id),nameSnapshot:text('name_snapshot').notNull()},t=>[primaryKey({columns:[t.versionId,t.tagId]})]);
export const schedules=pgTable('schedules',{
 id:uuid('id').primaryKey(),contentId:uuid('content_id').notNull().references(()=>contentItems.id),versionId:uuid('version_id').notNull(),status:text('status').notNull(),runAt:time('run_at').notNull(),attempts:integer('attempts').notNull().default(0),lastError:text('last_error')
},t=>[foreignKey({columns:[t.contentId,t.versionId],foreignColumns:[versions.contentId,versions.id]}),uniqueIndex('schedules_one_open_per_content').on(t.contentId).where(sql`${t.status} in ('pending','running','retrying','failed')`)]);
export const users=pgTable('users',{id:uuid('id').primaryKey(),role:text('role').notNull().unique(),passwordDigest:text('password_digest'),githubNumericId:text('github_numeric_id').unique()},t=>[check('owner_only',sql`${t.role} = 'owner'`)]);
export const oauthAccounts=pgTable('oauth_accounts',{id:uuid('id').primaryKey(),userId:uuid('user_id').notNull().references(()=>users.id),provider:text('provider').notNull(),providerNumericId:text('provider_numeric_id').notNull()},t=>[unique().on(t.provider,t.providerNumericId),unique().on(t.userId,t.provider)]);
export const sessions=pgTable('sessions',{id:uuid('id').primaryKey(),userId:uuid('user_id').notNull().references(()=>users.id),tokenDigest:text('token_digest').notNull().unique(),createdAt:time('created_at').notNull(),lastSeenAt:time('last_seen_at').notNull(),reauthenticatedAt:time('reauthenticated_at').notNull(),revokedAt:time('revoked_at')});
export const oauthAttempts=pgTable('oauth_attempts',{stateDigest:text('state_digest').primaryKey(),verifier:text('verifier').notNull(),expiresAt:time('expires_at').notNull(),consumedAt:time('consumed_at')});
export const rateLimits=pgTable('rate_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),resetAt:time('reset_at').notNull()});
export const auditEvents=pgTable('audit_events',{id:uuid('id').primaryKey(),userId:uuid('user_id').references(()=>users.id),action:text('action').notNull(),payload:jsonb('payload').notNull(),createdAt:time('created_at').notNull().defaultNow()});
export const siteSettings=pgTable('site_settings',{key:text('key').primaryKey(),value:jsonb('value').notNull()});
export const serviceLinks=pgTable('service_links',{id:uuid('id').primaryKey(),name:text('name').notNull(),url:text('url').notNull(),status:text('status').notNull(),statusUpdatedAt:time('status_updated_at').notNull().defaultNow()});
