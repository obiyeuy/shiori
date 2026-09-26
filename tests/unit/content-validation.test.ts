import { describe, expect, it } from 'vitest';
import { validateDraft } from '../../src/lib/server/content/validation.js';

describe('draft validation', () => {
  it('allows incomplete drafts but rejects invalid published content', () => {
    expect(validateDraft({ type: 'article', title: '', body: '' }, 'draft').ok).toBe(true);
    const result = validateDraft({ type: 'article', title: '', body: '' }, 'publish');
    expect(result.ok).toBe(false);
    expect(result.errors.map((error) => error.field)).toEqual(expect.arrayContaining(['title', 'body']));
  });

  it('keeps slug namespaces separate and validates slug shape', () => {
    expect(validateDraft({ type: 'article', title: 'A', body: 'B', slug: 'hello-world' }, 'publish').ok).toBe(true);
    expect(validateDraft({ type: 'article', title: 'A', body: 'B', slug: '中文 标题' }, 'publish').ok).toBe(false);
  });
});
