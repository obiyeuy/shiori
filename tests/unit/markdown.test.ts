import {describe,it,expect} from 'vitest';
import {renderMarkdown} from '../../src/lib/server/markdown/render.js';
describe('shared Markdown pipeline',()=>{
 it('renders CommonMark/GFM, footnotes, formula and code with stable unique heading anchors',async()=>{
  const source='# 标题\n\n# 标题\n\n~~旧~~ **新**[^1]\n\n[^1]: 注释\n\n- [x] 完成\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n$x^2$\n\n```js\nconst x = 1;\n```';
  const r=await renderMarkdown(source,'public');
  expect(r.html).toContain('<table>');expect(r.html).toContain('<del>旧</del>');expect(r.html).toContain('type="checkbox"');
  expect(r.html).toContain('katex');expect(r.html).toContain('shiki');expect(r.html).toContain('注释');
  expect(r.toc.map(h=>h.id)).toEqual(['heading-1','heading-2']);expect(r.text).not.toContain('const x');
  expect((await renderMarkdown(source,'preview')).html).toBe(r.html);
 });
 it('does not execute HTML/MDX/iframes or dangerous links and never loads external images',async()=>{
  const r=await renderMarkdown('<script>alert(1)</script>\n<iframe <img[^>]*src="https://evil.test"></iframe>\n<Widget run={alert(1)} />\n\n[x](javascript:alert(1)) ![外图](https://evil.test/x.png)','public');
  expect(r.html).not.toMatch(/<script|<iframe|<Widget|<img[^>]*src="https:\/\/evil|href="javascript:/i);
  expect(r.html).toContain('href="https://evil.test/x.png"');
 });
 it('tracks only controlled media references and blocks private routes in public HTML',async()=>{
  const r=await renderMarkdown('![说明](media:01234567-89ab-4def-8123-456789abcdef)\n\n[secret](/workspace) ![x](/media/private/key)','public');
  expect(r.media).toEqual([{key:'01234567-89ab-4def-8123-456789abcdef',variant:'display',description:'说明'}]);
  expect(r.html).toContain('/media/public/01234567-89ab-4def-8123-456789abcdef');expect(r.html).not.toContain('/media/private/');expect(r.html).not.toContain('href="/workspace"');
 });
 it('keeps Mermaid source per block for strict client rendering and excludes source from summary',async()=>{
  const r=await renderMarkdown('正文\n\n```mermaid\ngraph TD; A-->B\n```\n\n```mermaid\nnot a diagram\n```','preview');
  expect(r.diagrams).toHaveLength(2);expect(r.html).toContain('图表');expect(r.html).toContain('not a diagram');expect(r.text).toBe('正文');
 });
});
it('reference-style images cannot bypass remote-image policy, and unresolved local media blocks publication',async()=>{
 const r=await renderMarkdown('![remote][r]\n\n[r]: https://evil.test/image.png\n\n![missing](./missing.png)','public');
 expect(r.html).not.toMatch(/<img[^>]+https:\/\/evil/);expect(r.unresolved).toContain('./missing.png');
});
it('supports explicitly decorative images without exposing formula/source as summary',async()=>{
 const r=await renderMarkdown('![](media:01234567-89ab-4def-8123-456789abcdef "decorative")','public');expect(r.media[0].description).toBe('装饰图');expect(r.html).toContain('alt=""');expect(r.text).toBe('');
});
