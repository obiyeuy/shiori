import { testDatabase } from '../helpers/database.js';
import { describe, expect, it } from 'vitest';
import { ContentRepository } from '../../src/lib/server/content/repository.js';

async function setup() { const pool=await testDatabase(); return {pool, repository:new ContentRepository(pool)}; }

describe('content repository', () => {
  it('saves drafts with CAS and only exposes a published version publicly', async () => {
    const { pool, repository } = await setup();
    const contentId = await repository.createContent('article');
    await repository.saveDraft(contentId, { title: 'Draft only', body: '' }, 0);
    expect(await repository.getPublicVersionBySlug('article', 'draft-only')).toBeNull();
    await expect(repository.saveDraft(contentId, { title: 'stale', body: '' }, 0)).resolves.toMatchObject({ kind: 'conflict', serverRevision: 1 });
    await repository.publish(contentId, { title: 'Published', body: 'Body', slug: 'published' });
    const publicVersion = await repository.getPublicVersionBySlug('article', 'published');
    expect(publicVersion?.title).toBe('Published');
    await pool.end();
  });

  it('keeps archive independent from public visibility and rejects reused history aliases', async () => {
    const { pool, repository } = await setup();
    const first = await repository.createContent('article');
    await repository.publish(first, { title: 'One', body: 'Body', slug: 'same' });
    await repository.archive(first, true);
    expect(await repository.getPublicVersionBySlug('article', 'same')).not.toBeNull();
    const second = await repository.createContent('article');
    await expect(repository.publish(second, { title: 'Two', body: 'Body', slug: 'same' })).rejects.toThrow();
    await pool.end();
  });
});
