import {it,expect} from 'vitest';
import {normalizeSearch,searchTerms,buildSnippet} from '../../src/lib/server/search/normalize.js';
it('normalizes NFKC/case/whitespace and rejects overlong or excessive terms without truncating',()=>{
 expect(normalizeSearch('  Ｐｏｓｔｇｒｅｓｑｌ   中文 ')).toBe('postgresql 中文');
 expect(()=>searchTerms('a b c d e f g h i')).toThrow();
 expect(()=>normalizeSearch('x'.repeat(101))).toThrow();
});
it('preserves literal punctuation and escapes original contextual text',()=>{
 expect(searchTerms('C++ C# Node.js pg_trgm % _')).toEqual(['c++','c#','node.js','pg_trgm','%','_']);
 expect(buildSnippet('<b>PostgreSQL</b> 中文',['postgresql'])).toContain('&lt;b&gt;');
 expect(buildSnippet('没有匹配',['sql'])).toBe('');
});
