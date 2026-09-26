<script lang="ts">
 import ContentList from './ContentList.svelte';import type {PublicRow} from '$lib/content/public';
 let {title,items,page,total,path,tags=[],selected=[]}:{title:string;items:PublicRow[];page:number;total:number;path:string;tags?:{id:string;name:string}[];selected?:string[]}=$props();
 function pageHref(next:number){const params=new URLSearchParams();for(const id of selected)params.append('tag',id);if(next>1)params.set('page',String(next));return path+(params.size?'?'+params:'');}
</script>
<svelte:head><title>{title} · 个人综合站</title><link rel="canonical" href={`${path}${page>1?`?page=${page}`:''}`} />{#if selected.length}<meta name="robots" content="noindex,follow" />{/if}</svelte:head>
<main><h1>{title}</h1>
{#if tags.length}<form method="GET" action={path}><fieldset><legend>按标签筛选</legend>{#each tags as tag}<label><input type="checkbox" name="tag" value={tag.id} checked={selected.includes(tag.id)}/>{tag.name}</label>{/each}</fieldset><button>应用筛选</button>{#if selected.length}<a href={path}>清除筛选</a>{/if}</form>{/if}
<ContentList {items}/>{#if page>1&&!items.length}<p>已超出最后一页，<a href={pageHref(1)}>返回第一页</a>。</p>{/if}<nav aria-label="分页">{#if page>1}<a href={pageHref(page-1)}>上一页</a>{/if}<span>第 {page} 页 · 共 {total} 条</span>{#if page*20<total}<a href={pageHref(page+1)}>下一页</a>{/if}</nav></main>
<style>main{max-width:900px;margin:auto}nav,fieldset{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-block:24px}nav a,label{min-height:44px;padding:8px}fieldset{border:1px solid var(--border);border-radius:12px}button{min-height:44px}</style>
