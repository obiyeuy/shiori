export function normalizeSearch(input:string):string {
 const normalized=input.normalize('NFKC').trim().replace(/\s+/gu,' ').toLowerCase();
 if([...normalized].length>100)throw new Error('搜索词最多 100 个字符');return normalized;
}
export function searchTerms(input:string):string[]{
 const normalized=normalizeSearch(input);const terms=normalized?normalized.split(' '):[];
 if(terms.length>8)throw new Error('最多输入 8 个查询片段');return terms;
}
export function escapeHtml(value:string):string{return value.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]!));}
export function buildSnippet(document:string,terms:string[]):string{
 const chars=[...document];const normalized:string[]=[];const offsets:number[]=[];
 for(let i=0;i<chars.length;i++)for(const ch of chars[i].normalize('NFKC').toLowerCase()){normalized.push(ch);offsets.push(i);}
 const lookup=normalized.join('');const match=terms.map(t=>lookup.indexOf(t)).filter(i=>i>=0).sort((a,b)=>a-b)[0];
 if(match===undefined)return '';
 const normalizedIndex=[...lookup.slice(0,match)].length;const at=offsets[normalizedIndex]??0;const start=Math.max(0,at-60);const end=Math.min(chars.length,start+160);
 return escapeHtml((start?'…':'')+chars.slice(start,end).join('')+(end<chars.length?'…':''));
}
