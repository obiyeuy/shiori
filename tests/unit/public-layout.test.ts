import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const layout=readFileSync(resolve('src/lib/components/public/PublicLayout.svelte'),'utf8');
const scene=readFileSync(resolve('src/lib/components/public/SceneBanner.svelte'),'utf8');

describe('public page scene system',()=>{
 it('supports home, section and detail scene modes',()=>{
  expect(scene).toContain("SceneMode = 'home' | 'section' | 'detail'");
  expect(layout).toContain("mode={sceneMode === 'off' ? 'section' : sceneMode}");
  expect(layout).toContain("sceneMode");
 });
 it('uses section and detail routes instead of homepage-only scene',()=>{
  expect(layout).toContain("page.url.pathname === '/'");
  expect(layout).toContain("sceneMode !== 'off'");
 });
 it('keeps ordinary navigation free of circular arrow affordances',()=>{
  expect(layout).not.toContain('aria-hidden="true">↗</span></a></nav>');
 });
});
