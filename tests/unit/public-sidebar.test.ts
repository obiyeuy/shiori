import {describe,it,expect} from 'vitest';import {readFileSync} from 'node:fs';
describe('public sidebar responsibilities',()=>{it('uses context sidebar and removes duplicated utility blocks',()=>{const s=readFileSync('src/lib/components/public/PublicLayout.svelte','utf8');expect(s).toContain('ContextSidebar');expect(s).not.toContain('SITE STATUS');expect(s).not.toContain('QUICK LINKS');});});
