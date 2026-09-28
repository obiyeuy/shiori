<script lang="ts">
 import type {PublicRow} from '$lib/content/public';
 import ScheduleWidget from './ScheduleWidget.svelte';
 let {kind='listing',nowPlaying=null,filters=null,related=[],series=null}:{kind?:'home'|'listing'|'detail'|'search';nowPlaying?:{title:string;artist:string}|null;filters?:{q:string;types:string[];tags:string[]}|null;related?:Pick<PublicRow,'slug'|'type'|'title'|'summary'>[];series?:{id:string;name:string;total:number;previous:any;next:any}|null}=$props();
</script>
<aside class="context-sidebar" aria-label="当前页面上下文"><ScheduleWidget />
 {#if kind==='home'}<section><p class="kicker">RECENT</p><a href="/updates">查看最近更新</a></section>
 {:else if kind==='search'}<section><p class="kicker">SEARCH FILTERS</p>{#if filters?.q}<strong>“{filters.q}”</strong>{:else}<p class="muted">输入关键词开始搜索</p>{/if}{#if filters?.types.length}<small>类型 · {filters.types.join('、')}</small>{/if}{#if filters?.tags.length}<small>标签 · {filters.tags.length} 项</small>{/if}</section>
 {:else if kind==='detail'}{#if series}<section><p class="kicker">SERIES</p><a href={`/series/${series.id}`}>{series.name}</a><small>{series.total} 篇公开内容</small></section>{/if}{#if related.length}<section><p class="kicker">RELATED</p>{#each related as item}<a href={`/${item.type==='article'?'articles':item.type+'s'}/${item.slug}`}>{item.title||item.summary}</a>{/each}</section>{/if}
 {:else}<section><p class="kicker">{kind==='listing'?'BROWSE':'SPACE'}</p><p class="muted">按时间与主题慢慢浏览。</p></section>{/if}
</aside>
<style>.context-sidebar{padding:10px 0 10px 20px;border-left:1px solid var(--line);position:sticky;top:92px;min-height:120px}.context-sidebar section{padding:0 0 18px;margin-bottom:16px;border-bottom:1px solid var(--line)}.context-sidebar section:last-child{border-bottom:0}.kicker{margin:0 0 8px;color:var(--primary);font:0.625rem/1.4 'DM Mono',monospace;letter-spacing:.14em}.context-sidebar strong{display:block;font-size:1rem;line-height:1.4}.context-sidebar a{display:block;color:var(--text);text-decoration:none;font-size:0.8125rem;line-height:1.6;margin:6px 0}.context-sidebar a:hover{color:var(--primary)}.context-sidebar small{display:block;color:var(--muted);font-size:0.6875rem;margin-top:4px}.muted{color:var(--muted);font-size:0.75rem;margin:0}@media(max-width:950px){.context-sidebar{display:none}}</style>
