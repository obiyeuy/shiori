<script lang="ts">
 import {publicHref,publicLabels,type PublicRow} from '$lib/content/public';let {items,variant='list'}:{items:PublicRow[];variant?:'list'|'featured'|'projects'}=$props();
 const date=(value:string|Date)=>new Date(value).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'});
 const updated=(item:PublicRow)=>!!item.update_at&&new Date(item.update_at).getTime()>new Date(item.first_published_at).getTime();
</script>
{#if !items.length}<p class="muted">暂无公开内容。</p>{:else}<ul class={variant}>{#each items as item}<li>
{#if variant==='projects'}<div class="visual">{#if typeof item.payload.cover==='string'&&item.payload.cover}<img src={`/media/public/${item.payload.cover}`} alt={item.title}/>{:else}<span>作品</span>{/if}</div>{/if}
<div><a href={publicHref(item.type,item.slug)}><h3>{item.title||item.summary||publicLabels[item.type]}</h3></a><p>{item.summary}</p><p class="muted">{publicLabels[item.type]} · {updated(item)?'更新于 ':''}{date(item.update_at??item.first_published_at??item.published_at)}</p>{#if variant==='projects'}<p>{({completed:'已完成','in-progress':'进行中',paused:'暂停',stopped:'已停止'})[String(item.payload.projectStatus)]??''}</p>{/if}</div>
</li>{/each}</ul>{/if}
<style>ul{list-style:none;padding:0}li{padding:20px 0;border-bottom:1px solid var(--line);min-width:0}h3{font-size:20px;margin:0}p{margin:8px 0}a{color:var(--text);overflow-wrap:anywhere}.featured{display:grid;grid-template-columns:1.4fr 1fr;gap:0 32px}.featured li:first-child{grid-row:span 2;padding:32px;background:var(--soft);border-radius:16px}.featured li:first-child h3{font-size:28px}.projects li{display:grid;grid-template-columns:1fr 1.4fr;gap:32px;align-items:center}.visual{aspect-ratio:16/9;background:var(--soft);border-radius:16px;display:grid;place-items:center;overflow:hidden}.visual img{width:100%;height:100%;object-fit:cover}@media(max-width:767px){.featured,.projects li{display:block}.featured li:first-child{padding:20px}.visual{margin-bottom:20px}}</style>
