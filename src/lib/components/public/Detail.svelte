<script lang="ts">
 import type {PublicDetailNavigation} from '$lib/server/public-queries';
 import Comments from './Comments.svelte';import type {GiscusConfig} from '$lib/server/giscus';
 import MarkdownPreview from '$lib/components/editor/MarkdownPreview.svelte';import {publicHref,publicLabels,publicPaths,type PublicRow} from '$lib/content/public';
 let {item,giscus=null,navigation}:{item:PublicRow;giscus?:GiscusConfig|null;navigation:PublicDetailNavigation}=$props();
 const text=(key:string)=>typeof item.payload[key]==='string'?String(item.payload[key]):'';
</script>
<svelte:head><title>{item.title||item.summary||publicLabels[item.type]} · 个人综合站</title><meta name="description" content={item.summary} /><link rel="canonical" href={publicHref(item.type,item.slug)} /></svelte:head>
<main><a href={`/${publicPaths[item.type]}`}>返回{publicLabels[item.type]}</a><h1>{item.title||item.summary||publicLabels[item.type]}</h1><p class="muted">{new Date(item.first_published_at).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})}</p>
{#if text('cover')}<img class="cover" src={`/media/public/${text('cover')}`} alt={item.title||'内容封面'} />{/if}
{#if ['tool','resource','project'].includes(item.type)}<p>{text('description')}</p>{/if}
{#if item.type==='tool'}<p>状态：{({available:'可用',maintenance:'维护中',unavailable:'暂不可用',retired:'已停用'})[text('toolStatus')]??'未标记'}</p>{#if text('toolStatus')==='available'&&text('toolUrl')}<a href={text('toolUrl')} rel="noopener noreferrer">打开工具 ↗</a>{:else}<p>{text('unavailableReason')}</p><button disabled>暂不可打开</button>{/if}{/if}
{#if item.type==='project'}<p>作品状态：{({completed:'已完成','in-progress':'进行中',paused:'暂停',stopped:'已停止'})[text('projectStatus')]??''}</p><div class="actions">{#if text('demoUrl')}<a href={text('demoUrl')} rel="noopener noreferrer">演示 ↗</a>{/if}{#if text('codeUrl')}<a href={text('codeUrl')} rel="noopener noreferrer">源码 ↗</a>{/if}</div>{/if}
{#if item.type==='resource'}<p>来源：<a href={text('sourceUrl')} rel="noopener noreferrer">{text('sourceName')} ↗</a>{text('sourceUrl').startsWith('http:')?'（非加密链接）':''}</p>{/if}
<MarkdownPreview html={item.rendered_html}/>
{#if navigation.series}<section aria-label="系列导航"><h2><a href={`/series/${navigation.series.id}`}>{navigation.series.name}</a></h2><p>共 {navigation.series.total} 篇公开内容</p>{#if navigation.series.previous}<a href={publicHref(navigation.series.previous.type,navigation.series.previous.slug)}>系列上一项：{navigation.series.previous.title||navigation.series.previous.summary}</a>{/if}{#if navigation.series.next}<a href={publicHref(navigation.series.next.type,navigation.series.next.slug)}>系列下一项：{navigation.series.next.title||navigation.series.next.summary}</a>{/if}</section>{/if}
<nav aria-label="同类内容">{#if navigation.previous}<a href={publicHref(navigation.previous.type,navigation.previous.slug)}>上一篇：{navigation.previous.title||navigation.previous.summary}</a>{/if}{#if navigation.next}<a href={publicHref(navigation.next.type,navigation.next.slug)}>下一篇：{navigation.next.title||navigation.next.summary}</a>{/if}</nav>
{#if navigation.related.length}<section><h2>相关内容</h2>{#each navigation.related as related}<p><a href={publicHref(related.type,related.slug)}>{related.title||related.summary}</a></p>{/each}</section>{/if}
{#if item.payload.commentsEnabled===true}{#key JSON.stringify([item.content_id,giscus])}<Comments config={giscus} contentId={item.content_id}/>{/key}{/if}</main>
<style>section,nav{margin-block:32px}nav a,section>a{display:block;padding-block:12px}main{max-width:760px;margin:auto;min-width:0}h1{font-size:36px;line-height:1.35}.cover{max-width:100%;height:auto;border-radius:16px}@media(max-width:767px){h1{font-size:28px}}</style>
