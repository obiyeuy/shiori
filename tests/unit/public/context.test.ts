import {describe,it,expect} from 'vitest';
import {buildContext} from '../../../src/lib/components/public/context';
describe('public context adapter',()=>{
 it('marks schedule only for the home kind',()=>{expect(buildContext('home',{}).schedule).toBe(true);expect(buildContext('listing',{}).schedule).toBe(false);});
 it('deduplicates detail links by content id',()=>{const item={content_id:'a',type:'article',slug:'a',title:'A',summary:''} as const;const result=buildContext('detail',{series:{id:'s',name:'S',total:2,previous:item,next:null},related:[item,item]});expect(result.series?.previous?.content_id).toBe('a');expect(result.related).toHaveLength(0);});
 it('omits empty context and global sidebar for search',()=>{expect(buildContext('static',{}).groups).toHaveLength(0);expect(buildContext('search',{}).groups).toHaveLength(0);});
});
