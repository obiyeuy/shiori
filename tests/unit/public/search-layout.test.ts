import {describe,it,expect} from 'vitest';
import {searchPageHref} from '../../../src/lib/components/public/search-layout';
describe('search page links',()=>{it('preserves all search conditions while changing page',()=>{expect(searchPageHref({q:'hello world',type:['article','note'],tag:['t1','t2']},3)).toBe('/search?q=hello+world&type=article&type=note&tag=t1&tag=t2&page=3');});it('omits the default page and keeps an empty query valid',()=>{expect(searchPageHref({q:'',type:[],tag:[]},1)).toBe('/search');});});
