<script lang="ts">
 import ContentList from '$lib/components/public/ContentList.svelte';
 let {data}=$props();
</script>
<svelte:head><title>{data.identity.siteName} · 记录好奇，慢慢生长</title><meta name="description" content={data.identity.intro}/><link rel="canonical" href="/"/></svelte:head>
<main class="home">
 <nav class="browse" aria-label="内容探索"><a class="home-mark" href="/" aria-label="首页">⌂</a><a class="selected" href="/updates">最近更新</a><a href="/articles">文章</a><a href="/notes">笔记</a><a href="/moments">日常</a><a href="/projects">作品</a></nav>
 <section id="latest" class="latest"><div class="heading"><div><p class="eyebrow">THE JOURNAL</p><h2>最近的记录</h2></div><a href="/updates">全部记录 ↗</a></div><ContentList items={data.updates}/></section>
 {#if data.featured.length}<section class="content-section"><div class="heading"><div><p class="eyebrow">EDITOR'S PICKS</p><h2>值得再读</h2></div><a href="/articles">更多文章 ↗</a></div><ContentList items={data.featured} variant="featured"/></section>{/if}
 {#if data.projects.length}<section class="content-section"><div class="heading"><div><p class="eyebrow">MADE WITH CURIOSITY</p><h2>把想法做出来</h2></div><a href="/projects">全部作品 ↗</a></div><ContentList items={data.projects} variant="projects"/></section>{/if}
 {#if data.tools.length}<section class="content-section"><div class="heading"><div><p class="eyebrow">LITTLE HELPERS</p><h2>顺手的工具</h2></div><a href="/tools">工具箱 ↗</a></div><ContentList items={data.tools}/></section>{/if}
</main>
<style>
.browse{display:flex;align-items:center;flex-wrap:wrap;gap:6px;background:transparent;padding:0 0 12px;border-bottom:1px solid var(--line);border-radius:0;margin-bottom:16px}.browse a{display:flex;align-items:center;min-height:40px;padding:6px 16px;color:var(--muted);text-decoration:none;border-radius:24px;font-size:14px}.browse a:hover,.browse .selected{background:var(--soft);color:var(--primary)}.browse .home-mark{width:34px;padding:6px;justify-content:center;border-radius:50%;background:var(--primary);color:var(--on-primary);font-size:18px}.latest{min-width:0;background:color-mix(in srgb,var(--surface) 48%,var(--canvas));border-top:2px solid var(--soft-strong);border-radius:4px 4px 18px 18px;padding:22px 24px;scroll-margin-top:84px}.heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.eyebrow{font:11px/1.5 'DM Mono',monospace;letter-spacing:.12em;color:var(--primary);margin:0 0 6px}h2{font-size:21px;margin:0}.heading a{font-size:13px;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}.content-section{margin-top:22px;padding:20px 0 0;border-top:1px solid var(--line)}.content-section .heading{margin-bottom:18px}@media(max-width:767px){.browse{gap:2px;padding:6px}.browse a{padding:6px 12px}.latest{padding:18px 16px}.heading h2{font-size:20px}.content-section{margin-top:20px;padding-top:16px}}
</style>
