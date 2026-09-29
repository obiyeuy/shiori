<script lang="ts">
 import {onMount} from 'svelte';
 import {extractHeadings,readingProgress,uniqueNavigation,type Heading,type NavigationItem} from './reading-context';
 import {publicHref,type PublicType} from '$lib/content/public';
 let {html,currentId,navigation}:{html:string;currentId:string;navigation:{series:null|{id:string;name:string;total:number;previous:NavigationItem|null;next:NavigationItem|null};previous:NavigationItem|null;next:NavigationItem|null;related:NavigationItem[]}}=$props();
 const headings:Heading[]=extractHeadings(html);
 const nearby=uniqueNavigation(currentId,[...(navigation.series?[navigation.series.previous,navigation.series.next]:[]),navigation.previous,navigation.next].filter(Boolean) as NavigationItem[]);
 const related=uniqueNavigation(currentId,navigation.related).filter(item=>!nearby.some(other=>other.content_id===item.content_id));
 let progress=$state<number|null>(null);
 onMount(()=>{const update=()=>{const el=document.getElementById('reading-body');if(!el){progress=null;return;}const rect=el.getBoundingClientRect();progress=readingProgress(window.scrollY+rect.top,window.scrollY+rect.bottom,window.scrollY+window.innerHeight*.35);};update();window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);return()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update);};});
 const href=(item:NavigationItem)=>publicHref(item.type as PublicType,item.slug);
</script>
{#if headings.length || navigation.series || nearby.length || related.length}
<aside class="reading-context" aria-label="阅读上下文">
 {#if headings.length}<section class="outline"><div class="context-head"><p class="kicker">ON THIS PAGE</p>{#if progress!==null}<span>{progress}%</span>{/if}</div><nav aria-label="文章目录">{#each headings as heading}<a class:sub={heading.level===3} href={`#${heading.id}`}>{heading.text}</a>{/each}</nav></section>{/if}
 {#if navigation.series}<section><p class="kicker">SERIES</p><a href={`/series/${navigation.series.id}`}>{navigation.series.name}</a><small>{navigation.series.total} 篇公开内容</small></section>{/if}
 {#if nearby.length}<section><p class="kicker">NEXT / PREVIOUS</p>{#each nearby as item}<a href={href(item)}>{item.title||item.summary}</a>{/each}</section>{/if}
 {#if related.length}<section><p class="kicker">RELATED</p>{#each related.slice(0,3) as item}<a href={href(item)}>{item.title||item.summary}</a>{/each}</section>{/if}
</aside>
{/if}
<style>
.reading-context{display:grid;gap:16px;margin:0 0 28px;padding:16px 18px;border-left:2px solid color-mix(in srgb,var(--primary) 55%,var(--line));background:color-mix(in srgb,var(--primary) 4%,transparent);border-radius:0 14px 14px 0}.reading-context section{padding-bottom:14px;border-bottom:1px solid var(--line)}.reading-context section:last-child{padding-bottom:0;border-bottom:0}.context-head{display:flex;justify-content:space-between;align-items:center}.kicker{margin:0 0 7px;color:var(--primary);font:0.625rem/1.4 'DM Mono',monospace;letter-spacing:.14em}.context-head span{font:0.625rem 'DM Mono',monospace;color:var(--muted)}nav{display:grid;gap:4px}a{display:block;color:var(--text);text-decoration:none;font-size:.78rem;line-height:1.55;padding:3px 0}a:hover{color:var(--primary)}a.sub{padding-left:12px;color:var(--muted);font-size:.74rem}small{display:block;color:var(--muted);font-size:.68rem;margin-top:4px}
</style>
