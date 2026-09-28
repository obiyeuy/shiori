<script lang="ts">
 import NavIcon from './NavIcon.svelte';
 import ContentList from './ContentList.svelte';import type {PublicRow} from '$lib/content/public';
 let {title,items,page,total,path,tags=[],selected=[],variant='list'}:{title:string;items:PublicRow[];page:number;total:number;path:string;tags?:{id:string;name:string}[];selected?:string[];variant?:'list'|'projects'|'moments'}=$props();
 const moods:Record<string,{eyebrow:string;intro:string;icon:string;tone:string}>={
 '/articles':{eyebrow:'ESSAYS & IDEAS',intro:'把一个问题想透，把值得分享的思考写下来。',icon:'articles',tone:'var(--primary)'},
 '/notes':{eyebrow:'FIELD NOTES',intro:'边学边记。留下思路、方法和下一次能用上的线索。',icon:'notes',tone:'#428378'},
 '/moments':{eyebrow:'SMALL DAYS',intro:'一些近况，一点碎碎念。收藏日常里轻轻闪光的片刻。',icon:'moments',tone:'#b36986'},
 '/projects':{eyebrow:'THE WORKSHOP',intro:'从念头到成品，在这里展示尝试、进展和作品。',icon:'projects',tone:'#ad7937'},
 '/tools':{eyebrow:'TOOLBOX',intro:'把重复的事情交给工具，给喜欢的事情留一点时间。',icon:'tools',tone:'#4582a4'},
 '/resources':{eyebrow:'BOOKMARK SHELF',intro:'认真用过、值得收藏的链接与资源。',icon:'resources',tone:'#7b729f'},
 '/updates':{eyebrow:'LATEST ENTRIES',intro:'文章、笔记、作品与日常，沿着时间慢慢生长。',icon:'articles',tone:'var(--primary)'}
 };
 const mood=$derived(moods[path]??moods['/updates']);
 function pageHref(next:number){const params=new URLSearchParams();for(const id of selected)params.append('tag',id);if(next>1)params.set('page',String(next));return path+(params.size?'?'+params:'');}
</script>
<svelte:head><title>{title} · 个人综合站</title><link rel="canonical" href={`${path}${page>1?`?page=${page}`:''}`} />{#if selected.length}<meta name="robots" content="noindex,follow" />{/if}</svelte:head>
<main class:projects-page={variant==='projects'} class="listing" style:--section-tone={mood.tone}><header class="listing-header"><div><p class="eyebrow">{mood.eyebrow}</p><h1>{title}</h1><p class="lede">{mood.intro}</p></div><span class="header-mark"><NavIcon name={mood.icon} size={64}/></span></header>
{#if tags.length}<form method="GET" action={path}><fieldset><legend>按标签筛选</legend>{#each tags as tag}<label><input type="checkbox" name="tag" value={tag.id} checked={selected.includes(tag.id)}/>{tag.name}</label>{/each}</fieldset><button>应用筛选</button>{#if selected.length}<a href={path}>清除筛选</a>{/if}</form>{/if}
<div class="listing-rule"><span>{total} 条公开记录</span><span>按时间倒序</span></div><ContentList {items} {variant}/>{#if page>1&&!items.length}<p>已超出最后一页，<a href={pageHref(1)}>返回第一页</a>。</p>{/if}<nav aria-label="分页">{#if page>1}<a href={pageHref(page-1)}>上一页</a>{/if}<span>第 {page} 页 · 共 {total} 条</span>{#if page*20<total}<a href={pageHref(page+1)}>下一页</a>{/if}</nav></main>
<style>.listing{max-width:920px;margin:auto}.listing-header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:22px;align-items:start;padding:8px 0 18px;margin-bottom:18px;border-bottom:1px solid var(--line)}.header-mark{color:var(--section-tone);font-size:1.625rem;line-height:1;opacity:.65;padding-top:4px}.eyebrow{margin:0 0 10px;color:var(--section-tone);font:700 0.6875rem/1.2 'DM Mono',monospace;letter-spacing:.14em}.listing h1{margin:0;font-size:clamp(1.875rem,4vw,2.625rem);letter-spacing:-.035em}.lede{margin:12px 0 0;color:var(--muted);font-size:1rem}.listing-rule{display:flex;justify-content:space-between;gap:16px;padding:18px 0 0;color:var(--muted);font:0.6875rem/1.4 'DM Mono',monospace}.listing form{margin:24px 0}.listing nav,fieldset{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-block:24px}nav a,label{min-height:44px;padding:8px}fieldset{border:1px solid var(--line);border-radius:var(--radius-md);padding:16px}button{min-height:44px}@media(max-width:767px){.listing-header{grid-template-columns:1fr auto;gap:12px;padding-top:8px}.header-mark{font-size:2rem}.listing h1{font-size:1.875rem}.lede{font-size:0.9375rem}.listing-rule{font-size:0.625rem}}
</style>
