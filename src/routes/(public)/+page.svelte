<script lang="ts">
 import ContentList from '$lib/components/public/ContentList.svelte';
 let {data} = $props();
 let bannerFailed = $state(false);
 const customBanner = $derived(data.identity.banner?.desktop && !bannerFailed);
 const bannerSrc = $derived(customBanner ? `/media/public/${data.identity.banner!.desktop}` : '/images/makeine-img_visual03.jpg');
</script>

<svelte:head>
 <title>{data.identity.siteName} · 记录好奇，慢慢生长</title>
 <meta name="description" content="技术与日常之间的一方小天地。写下学习的过程，收藏喜欢的事物，让零散的好奇慢慢长成作品。" />
 <link rel="canonical" href="/" />
</svelte:head>

<main class="home">
 <section class="hero" aria-label="欢迎">
  <div class="welcome">
   <p class="eyebrow"><span class="status-dot"></span> A LITTLE CORNER OF THE INTERNET</p>
   <h1>保持好奇，<br />让热爱<em>慢慢生长。</em></h1>
   <p class="hero-copy">在代码与生活之间，留一块自由生长的地方。<br class="desktop-break" />记录想法、打磨作品，也收藏平凡日子里的闪光。</p>
   <div class="hero-actions"><a class="button" href="#latest">开始阅读 <span aria-hidden="true">↗</span></a><a class="text-link" href="/about">认识一下 <span aria-hidden="true">→</span></a></div>
   <div class="hero-footnote"><span>NOTES / IDEAS / LITTLE THINGS</span><span aria-hidden="true">01 — ∞</span></div>
  </div>
  <div class="hero-art">
   <picture>
    {#if customBanner && data.identity.banner?.mobile}<source media="(max-width:767px)" srcset={`/media/public/${data.identity.banner.mobile}`} />{/if}
    <img src={bannerSrc} alt={customBanner ? '' : '八奈见杏菜在甜点店的官方场景图'} width="1440" height="779" fetchpriority="high" style:object-position={customBanner ? `${data.identity.banner!.x}% ${data.identity.banner!.y}%` : '53% center'} onerror={()=>bannerFailed=true} />
   </picture>
   <div class="art-caption"><span>STAY CURIOUS</span><p>世界很大，<br />值得慢慢探索。</p></div>
   <span class="art-index" aria-hidden="true">日々の記録</span>
  </div>
 </section>
 <div class="image-credit">
  {#if customBanner && data.identity.banner?.credit}{data.identity.banner.credit}{#if data.identity.banner.source} · <a href={data.identity.banner.source} rel="noopener noreferrer">图片来源 ↗</a>{/if}
  {:else if !customBanner}<a href="https://makeine-anime.com/" rel="noopener noreferrer">场景出自《败犬女主太多了！》 · ©雨森たきび／小学館／マケイン応援委員会 · 官方来源 ↗</a>{/if}
 </div>

 <section class="intro" aria-label="个人介绍">
  <div class="intro-title"><span class="small-star" aria-hidden="true">✳</span><div><p class="eyebrow">HELLO, FRIEND</p><h2>你好，欢迎来坐坐。</h2></div></div>
  <p>{data.identity.intro}</p>
  <div class="interests"><span>技术探索</span><span>日常碎片</span><span>持续创作</span></div>
 </section>

 <section class="presence" aria-label="最近状态"><div><span>NOW</span><strong>正在整理个人站</strong><small>把零散的想法重新放回自己的位置。</small></div><div><span>WATCHING</span><strong>最近在看一些远方</strong><small>电影、书和路上偶尔遇见的风景。</small></div><div><span>NEXT</span><strong>继续写，继续做</strong><small>让下一个小作品慢慢长出来。</small></div></section>

 <div class="journal-grid">
  <section id="latest" class="latest">
   <div class="heading"><div><p class="eyebrow">THE JOURNAL</p><h2>最近更新<span class="section-dot">.</span></h2></div><a class="text-link" href="/updates">所有记录 <span aria-hidden="true">↗</span></a></div>
   <div class="journal-list"><ContentList items={data.updates} /></div>
  </section>
  <aside class="sidebar"><div class="sidebar-note"><p class="eyebrow">A NOTE TO SELF</p><h3>不用着急，<br />每一步都算数。</h3><p>把想做的事拆小一点，给新的可能留一点空间。</p><a class="text-link" href="/moments">生活里的小事 <span aria-hidden="true">→</span></a></div></aside>
 </div>

 {#if data.featured.length}<section class="content-section featured-section"><div class="heading"><div><p class="eyebrow">WORTH A SECOND LOOK</p><h2>值得再读<span class="section-dot">.</span></h2></div><span class="section-note">一些反复打磨的想法</span></div><ContentList items={data.featured} variant="featured" /></section>{/if}
 {#if data.projects.length}<section class="content-section"><div class="heading"><div><p class="eyebrow">MADE WITH CURIOSITY</p><h2>把想法做出来<span class="section-dot">.</span></h2></div><a class="text-link" href="/projects">全部作品 <span aria-hidden="true">↗</span></a></div><ContentList items={data.projects} variant="projects" /></section>{/if}
 {#if data.tools.length}<section class="content-section tools-section"><div class="heading"><div><p class="eyebrow">LITTLE HELPERS</p><h2>顺手的工具<span class="section-dot">.</span></h2></div><a class="text-link" href="/tools">工具箱 <span aria-hidden="true">↗</span></a></div><ContentList items={data.tools} /></section>{/if}
</main>

<style>
 .hero{position:relative;display:block;min-height:560px;overflow:hidden;margin:0 calc(28px * -1) 0;width:calc(100% + 56px);background:#142d45}
 .welcome{position:absolute;z-index:3;inset:0 auto 0 0;width:min(54%,620px);display:flex;flex-direction:column;justify-content:center;padding:58px 54px 34px 56px;min-width:0;background:linear-gradient(90deg,var(--canvas) 0%,color-mix(in srgb,var(--canvas) 92%,transparent) 70%,transparent 100%)}.eyebrow{font:600 10px/1.5 'DM Mono',monospace;letter-spacing:.16em;color:var(--muted);margin:0 0 18px}.welcome .eyebrow{display:flex;align-items:center;gap:9px;letter-spacing:.1em}.status-dot{width:7px;height:7px;flex-shrink:0;background:#4b8874;border-radius:50%;box-shadow:0 0 0 4px #4b887414}.welcome h1{font-family:var(--font-display)}.welcome h1{font-size:clamp(32px,3.2vw,43px);letter-spacing:-.04em;line-height:1.4;margin:4px 0 20px;font-weight:800}.welcome h1 em{display:block;font-style:normal;color:var(--primary)}.hero-copy{font-size:14px;line-height:1.95;color:var(--muted);margin:0 0 30px}.hero-actions{display:flex;gap:26px;align-items:center}.button{display:inline-flex;align-items:center;gap:28px;padding:13px 21px;border-radius:12px;background:var(--text);color:var(--surface);font-size:14px;font-weight:700;text-decoration:none}.button:hover{transform:translateY(-2px);background:var(--primary);color:var(--on-primary)}.text-link{display:inline-flex;align-items:center;gap:12px;font-size:13px;font-weight:700;text-decoration:none;min-height:44px}.hero-footnote{display:flex;justify-content:space-between;gap:12px;margin-top:28px;padding-top:18px;border-top:1px solid var(--line);font:10px/1.5 monospace;letter-spacing:.12em;color:var(--muted)}
 .hero-art{position:absolute;inset:0;overflow:hidden;background:#124b60;min-height:560px}.hero-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.hero-art::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,#112f49c9)}.art-caption{position:absolute;z-index:1;bottom:34px;left:32px;color:white}.art-caption span{font:10px monospace;letter-spacing:.24em;color:#e1ecf2}.art-caption p{font-size:25px;font-weight:600;line-height:1.6;letter-spacing:.04em;margin:12px 0 0}.art-index{position:absolute;right:25px;top:28px;z-index:1;writing-mode:vertical-rl;letter-spacing:.3em;color:white;font-size:12px}.image-credit{min-height:30px;text-align:right;font-size:10px;padding:9px 3px 0;color:var(--muted)}.image-credit a{color:inherit;text-decoration:none}
 .intro{display:grid;grid-template-columns:1fr 1.2fr auto;gap:30px;align-items:center;padding:34px 4px 40px;border-bottom:1px solid var(--line)}.intro-title{display:flex;gap:16px;align-items:center}.small-star{font-size:46px;color:var(--primary);line-height:1}.intro .eyebrow{margin-bottom:7px}.intro h2{font-size:19px;margin:0;letter-spacing:-.025em}.intro>p{font-size:13px;color:var(--muted);margin:0;line-height:1.9}.interests{display:flex;flex-wrap:wrap;max-width:155px;gap:7px}.interests span{font-size:10px;padding:5px 10px;background:var(--surface);border:1px solid var(--line);border-radius:30px;color:var(--muted)}
 .presence{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:28px;border-block:1px solid var(--line)}.presence>div{display:grid;gap:8px;padding:20px 22px 20px 0;background:transparent}.presence>div+div{padding-left:22px;border-left:1px solid var(--line)}.presence span{color:var(--primary);font:10px 'DM Mono',monospace;letter-spacing:.14em}.presence strong{font-size:16px}.presence small{color:var(--muted);font-size:12px;line-height:1.6}.journal-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:64px;margin-top:54px}.latest{scroll-margin-top:105px;min-width:0}.heading{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:28px}.heading .eyebrow{margin-bottom:8px}.heading h2{font-size:24px;margin:0;letter-spacing:-.035em}.section-dot{color:var(--primary);margin-left:3px}.sidebar{display:grid;align-content:start;gap:22px;align-self:start}.sidebar-note{padding:6px 0 0 22px;border-left:2px solid var(--primary)}.sidebar-note .eyebrow{margin-bottom:12px}.sidebar-note h3{font-size:19px;line-height:1.5;margin-bottom:12px}.sidebar-note p:not(.eyebrow){font-size:13px;line-height:1.8;color:var(--muted);margin-bottom:10px}.content-section{margin-top:64px}.featured-section{padding-top:44px;border-top:1px solid var(--line)}.section-note{font-size:12px;color:var(--muted)}.tools-section{padding-top:4px}
 @media(max-width:1023px){.welcome{padding:42px 34px 24px}.hero,.hero-art{min-height:500px}.journal-grid{gap:30px;grid-template-columns:minmax(0,1fr) 260px}.intro{grid-template-columns:1fr 1fr}.interests{display:none}.desktop-break{display:none}.hero-footnote{font-size:10px}.heading h2{font-size:24px}}
 @media(max-width:767px){.hero{min-height:0;margin-inline:-16px;width:calc(100% + 32px)}.welcome{position:relative;width:100%;inset:auto;padding:30px 24px 23px;background:var(--canvas)}.welcome h1{font-family:var(--font-display)}.welcome h1{font-size:30px;line-height:1.4;margin-top:0}.welcome h1 em{display:inline}.welcome .eyebrow{font-size:10px;letter-spacing:.04em}.hero-copy{font-size:13px;margin-bottom:22px}.hero-footnote{margin-top:25px}.hero-art{position:relative;inset:auto;min-height:320px;height:320px}.art-caption{bottom:20px;left:24px}.art-caption p{font-size:20px}.image-credit{font-size:9px}.intro{grid-template-columns:1fr;gap:17px;padding:27px 4px}.presence>div{padding:16px 0}.presence>div+div{padding-left:0;border-left:0;border-top:1px solid var(--line)}.intro>p{font-size:13px}.journal-grid{grid-template-columns:1fr;margin-top:36px;gap:30px}.sidebar{display:none}.sidebar-note{padding-left:16px}.heading{gap:12px;margin-bottom:18px}.heading h2{font-size:23px}.heading .text-link{font-size:12px}.content-section{margin-top:38px}.section-note{display:none}.tools-section{padding:0}.featured-section{padding-top:30px}}
</style>
