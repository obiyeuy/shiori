<script lang="ts">
 import ContentList from '$lib/components/public/ContentList.svelte';
 let {data}=$props();
</script>
<svelte:head><title>{data.identity.siteName} · 记录好奇，慢慢生长</title><meta name="description" content={data.identity.intro}/><link rel="canonical" href="/"/></svelte:head>
<main class="home">

 <section id="latest" class="latest"><div class="heading"><div><p class="eyebrow">THE JOURNAL</p><h2>最近的记录</h2></div><a href="/updates">全部记录 ↗</a></div><ContentList items={data.updates}/></section>
 {#if data.featured.length}<section class="content-section"><div class="heading"><div><p class="eyebrow">EDITOR'S PICKS</p><h2>值得再读</h2></div><a href="/articles">更多文章 ↗</a></div><ContentList items={data.featured} variant="featured"/></section>{/if}
 {#if data.projects.length}<section class="content-section"><div class="heading"><div><p class="eyebrow">MADE WITH CURIOSITY</p><h2>把想法做出来</h2></div><a href="/projects">全部作品 ↗</a></div><ContentList items={data.projects} variant="projects"/></section>{/if}
 {#if data.tools.length}<section class="content-section"><div class="heading"><div><p class="eyebrow">LITTLE HELPERS</p><h2>顺手的工具</h2></div><a href="/tools">工具箱 ↗</a></div><ContentList items={data.tools}/></section>{/if}
</main>
<style>
.latest{min-width:0;background:transparent;border-top:1px solid var(--line);border-radius:0;padding:20px 4px;scroll-margin-top:84px}.heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.eyebrow{font:0.6875rem/1.5 'DM Mono',monospace;letter-spacing:.12em;color:var(--primary);margin:0 0 6px}h2{font-size:1.3125rem;margin:0}.heading a{font-size:0.8125rem;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}.content-section{margin-top:24px;padding:20px 4px 0;border-top:1px solid var(--line)}.content-section .heading{margin-bottom:18px}@media(max-width:767px){.latest{padding:18px 16px}.heading h2{font-size:1.25rem}.content-section{margin-top:20px;padding-top:16px}}
</style>
