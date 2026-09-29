import {describe,it,expect} from 'vitest';
import {extractHeadings,readingProgress,uniqueNavigation} from '../../../src/lib/components/public/reading-context';

describe('reading context',()=>{
 it('extracts headings and gives duplicate titles stable ids',()=>{
  expect(extractHeadings('<h2>Intro</h2><h3>Intro</h3><h2>No <em>HTML</em></h2>')).toEqual([
   {level:2,text:'Intro',id:'intro'},{level:3,text:'Intro',id:'intro-2'},{level:2,text:'No HTML',id:'no-html'}
  ]);
 });
 it('omits progress for short or invalid reading ranges and clamps bounds',()=>{expect(readingProgress(10,10,10)).toBe(null);expect(readingProgress(20,100,100)).toBe(100);expect(readingProgress(0,100,50)).toBe(50);});
 it('removes current and duplicate navigation items',()=>{const a={content_id:'a',type:'article',slug:'a',title:'A',summary:''};expect(uniqueNavigation('a',[a,{...a,slug:'a-copy'}])).toEqual([]);});
});
