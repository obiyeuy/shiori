<script lang="ts">
 import ContentList from '$lib/components/public/ContentList.svelte';
 let {data}=$props();
</script>
<svelte:head><title>{data.identity.siteName} · 记录好奇，慢慢生长</title><meta name="description" content={data.identity.intro}/><link rel="canonical" href="/"/></svelte:head>
<main class="home">
 <nav class="browse" aria-label="内容探索"><a class="selected" href="/updates">最近更新</a><a href="/articles">文章</a><a href="/notes">笔记</a><a href="/moments">日常</a><a href="/projects">作品</a></nav>
 <div class="journal-grid">
 <section id="latest" class="latest"><div class="heading"><div><p class="eyebrow">THE JOURNAL</p><h2>最近的记录</h2></div><a href="/updates">全部记录 ↗</a></div><ContentList items={data.updates}/></section>
 <aside class="reading-shelf"><section><p class="eyebrow">HELLO, FRIEND</p><h2>欢迎来坐坐。</h2><p class="intro">{data.identity.intro}</p><a href="/about">认识一下 →</a></section>{#if data.featured.length}<section><p class="eyebrow">EDITOR'S PICKS</p><h2>值得再读</h2><ContentList items={data.featured}/></section>{/if}</aside>
 </div>
 {#if data.projects.length}<section class="content-section"><div class="heading"><div><p class="eyebrow">MADE WITH CURIOSITY</p><h2>把想法做出来</h2></div><a href="/projects">全部作品 ↗</a></div><ContentList items={data.projects} variant="projects"/></section>{/if}
 {#if data.tools.length}<section class="content-section"><div class="heading"><div><p class="eyebrow">LITTLE HELPERS</p><h2>顺手的工具</h2></div><a href="/tools">工具箱 ↗</a></div><ContentList items={data.tools}/></section>{/if}
</main>
<style>
.browse{display:flex;flex-wrap:wrap;gap:6px;background:var(--surface);padding:8px 12px;border-radius:12px;margin-bottom:16px}.browse a{display:flex;align-items:center;min-height:40px;padding:6px 16px;color:var(--muted);text-decoration:none;border-radius:24px;font-size:14px}.browse a:hover,.browse .selected{background:var(--soft);color:var(--primary)}.journal-grid{display:grid;grid-template-columns:minmax(0,1fr) 236px;gap:20px}.latest{min-width:0;background:var(--surface);border-radius:14px;padding:22px 24px;scroll-margin-top:84px}.heading{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.eyebrow{font:11px/1.5 'DM Mono',monospace;letter-spacing:.12em;color:var(--primary);margin:0 0 6px}h2{font-size:21px;margin:0}.heading a,.reading-shelf a{font-size:13px;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}.reading-shelf{min-width:0}.reading-shelf section{padding:12px 0 22px;margin-bottom:16px;border-bottom:1px solid var(--line)}.reading-shelf h2{font-size:17px}.intro{font-size:13px;line-height:1.85;color:var(--muted);margin:12px 0 0}.content-section{margin-top:26px;padding-top:20px;border-top:1px solid var(--line)}.content-section .heading{margin-bottom:18px}@media(max-width:1200px){.journal-grid{grid-template-columns:1fr}.reading-shelf{display:grid;grid-template-columns:1fr 1.5fr;gap:24px}.reading-shelf section{margin:0}}@media(max-width:767px){.browse{gap:2px;padding:6px}.browse a{padding:6px 12px}.latest{padding:18px 16px}.heading h2{font-size:20px}.reading-shelf{display:block}.reading-shelf section{padding:16px 0}.content-section{margin-top:20px}}
</style>
