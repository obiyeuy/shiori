import { describe, it, expect } from 'vitest';
import { verifyCsrf, isSessionFresh } from '../../src/lib/server/auth/session.js';
import { validateDraft } from '../../src/lib/server/content/validation.js';
describe('security regressions', () => {
 it('compares request origin against trusted application origin', () => {
  expect(verifyCsrf('https://evil.test', 'https://site.test')).toBe(false);
  expect(verifyCsrf(null, 'https://site.test')).toBe(false);
 });
 it('expires at the exact idle deadline and rejects future timestamps', () => {
  const now = new Date('2026-09-26T00:00:00Z');
  expect(isSessionFresh({createdAt:new Date('2026-09-25'),lastSeenAt:new Date('2026-09-25')}, now)).toBe(false);
  expect(isSessionFresh({createdAt:new Date('2026-09-27'),lastSeenAt:new Date('2026-09-27')}, now)).toBe(false);
 });
 it.each([
  {type:'project', title:'Project',body:'body',slug:'project'},
  {type:'resource',title:'Resource',slug:'resource'},
  {type:'tool',title:'Tool',slug:'tool',toolStatus:'available',toolUrl:'javascript:alert(1)'},
  {type:'tool',title:'Tool',slug:'tool',description:'Tool',toolStatus:'available',toolUrl:'/%77orkspace'},
  {type:'article',title:'a'.repeat(121),body:'body',slug:'article'},
  {type:'article',title:'A',body:'** **',slug:'article'}
 ])('rejects invalid publish fields: %j', (draft) => { expect(validateDraft(draft as any, 'publish').ok).toBe(false); });
 it('allows resources without body when their required fields exist', () => {
  expect(validateDraft({type:'resource',title:'Docs',slug:'docs',description:'Manual',sourceName:'Docs',sourceUrl:'https://example.com'} as any,'publish').ok).toBe(true);
 });
 it('accepts empty optional fields in incomplete drafts', () => {
  expect(validateDraft({type:'article',slug:'',title:'',body:''},'draft').ok).toBe(true);
 });
});
it('rejects unknown and type-inapplicable fields without rejecting incomplete drafts',()=>{
 expect(validateDraft({type:'article',arbitrarySecret:{value:'secret'}} as any,'draft').ok).toBe(false);
 expect(validateDraft({type:'article',toolUrl:'https://example.com'} as any,'draft').ok).toBe(false);
 expect(validateDraft({type:'tool',title:''},'draft').ok).toBe(true);
});
