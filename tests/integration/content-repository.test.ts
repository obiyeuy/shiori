import { testDatabase } from '../helpers/database.js';
import { describe, expect, it } from 'vitest';
import { ContentRepository } from '../../src/lib/server/content/repository.js';
import {publishFixture,getCurrentPublicBySlug} from '../helpers/content-fixture.js';

async function setup() { const pool=await testDatabase(); return {pool, repository:new ContentRepository(pool)}; }

describe('content repository', () => {
  it('saves drafts with CAS and only exposes a published version publicly', async () => {
    const { pool, repository } = await setup();
    const contentId = await repository.createContent('article');
    await repository.saveDraft(contentId, { title: 'Draft only', body: '' }, 0);
    expect(await getCurrentPublicBySlug(pool,'article', 'draft-only')).toBeNull();
    await expect(repository.saveDraft(contentId, { title: 'stale', body: '' }, 0)).resolves.toMatchObject({ kind: 'conflict', serverRevision: 1 });
    await publishFixture(pool,contentId, { title: 'Published', body: 'Body', slug: 'published' });
    const publicVersion = await getCurrentPublicBySlug(pool,'article', 'published');
    expect(publicVersion?.title).toBe('Published');
    await pool.query('DELETE FROM public_content WHERE content_id=$1', [contentId]);
    expect(await getCurrentPublicBySlug(pool,'article', 'published')).toBeNull();
    await pool.end();
  });

  it('keeps archive independent from public visibility and rejects reused history aliases', async () => {
    const { pool, repository } = await setup();
    const first = await repository.createContent('article');
    await publishFixture(pool,first, { title: 'One', body: 'Body', slug: 'same' });
    await repository.archive(first, true);
    expect(await getCurrentPublicBySlug(pool,'article', 'same')).not.toBeNull();
    const second = await repository.createContent('article');
    await expect(publishFixture(pool,second, { title: 'Two', body: 'Body', slug: 'same' })).rejects.toThrow();
    await pool.end();
  });
});
