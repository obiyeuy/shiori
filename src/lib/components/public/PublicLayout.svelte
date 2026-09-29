<script lang="ts">
 import PersonalSpace from './PersonalSpace.svelte';
 import NavIcon from './NavIcon.svelte';
 import type {Snippet} from 'svelte';
 import {onMount} from 'svelte';
 import {page} from '$app/state';
 import '$lib/components/ui/tokens.css';
 import SceneBanner, {type Banner} from './SceneBanner.svelte';
 import ContextSidebar from './ContextSidebar.svelte';
 import MusicPlayer from './MusicPlayer.svelte';
 let {children,tools=false,siteName='个人综合站',intro='记录想法、分享作品，收藏日常。',banner=null,status=null,socialLinks=[],contextKind='listing'}:{children:Snippet;tools?:boolean;siteName?:string;intro?:string;banner?:Banner|null;status?:{text:string;updatedAt:string|null}|null;socialLinks?:{label:string;url:string}[];contextKind?:'home'|'listing'|'detail'|'search'}=$props();
 let theme=$state('system');let hue=$state(275);let fontSize=$state('normal');let menuOpen=$state(false);let scrollY=$state(0);let settingsOpen=$state(false);let backdrop=$state(true);let reducedMotion=$state(false);
 const home=$derived(page.url.pathname === '/');
 const detail=$derived(/^\/(articles|notes|moments|projects|tools|resources)\/[^/]+/.test(page.url.pathname));
 const sceneMode=$derived(!backdrop ? 'off' : home ? 'home' : detail ? 'detail' : 'section');
 const sceneThreshold=$derived(home ? 500 : detail ? 220 : 260);
 const showScene=$derived(sceneMode !== 'off');
 function setBackdrop(value:boolean){backdrop=value;document.documentElement.dataset.sceneBackground=String(value);try{localStorage.setItem('scene-background',String(value));}catch{/* optional */}}
 const links=[['/','首页','home'],['/articles','文章','articles'],['/notes','笔记','notes'],['/moments','动态','moments'],['/projects','作品','projects']];
 const extraLinks=[['/resources','资源','resources'],['/tags','标签','tags'],['/series','系列','series'],['/about','关于','about']];
 let moreOpen=$state(false);
 let closeTimer:ReturnType<typeof setTimeout>|undefined;
 function cancelClose(){clearTimeout(closeTimer);closeTimer=undefined;}
 function closeSettings(){cancelClose();settingsOpen=false;}
 function pointerMoved(event:PointerEvent){
  if(!settingsOpen||event.pointerType==='touch')return;
  const inside=(event.target as Element)?.closest('#theme-colors,.color-trigger');
  if(inside){cancelClose();return;}
  if(!closeTimer)closeTimer=setTimeout(closeSettings,220);
 }

 const section=$derived([...links,...extraLinks,['/tools','工具','tools']].find(([href])=>isActive(href)));
 const sceneLabel=$derived(section?.[1] ?? (detail ? '内容详情' : '站点栏目'));
 const sceneIcon=$derived(section?.[2] ?? 'more');
 $effect(()=>{void page.url.pathname;moreOpen=false;settingsOpen=false;menuOpen=false;});
 const activePath=$derived(page.url.pathname);
 const isActive=(href:string)=>activePath===href||activePath.startsWith(`${href}/`);
 function setHue(value:number){hue=value;document.documentElement.style.setProperty('--palette-hue',String(value));try{localStorage.setItem('color-hue',String(value));}catch{/* optional */}}
 function setFontSize(value:string){fontSize=value;document.documentElement.dataset.fontSize=value;try{localStorage.setItem('font-size',value);}catch{/* optional */}}
 function setTheme(value:string){theme=value;document.documentElement.dataset.theme=value;try{localStorage.setItem('theme',value);}catch{/* optional */}}
 const themeOptions=[{value:'system',label:'跟随系统',icon:'system'},{value:'light',label:'浅色',icon:'sun'},{value:'dark',label:'深色',icon:'moon'}];
 const themeIndex=$derived(Math.max(0,themeOptions.findIndex(item=>item.value===theme)));
 const currentTheme=$derived(themeOptions[themeIndex]);
 const nextTheme=$derived(themeOptions[(themeIndex+1)%themeOptions.length]);
 const themeHint=$derived('当前：'+currentTheme.label+'；点击切换为'+nextTheme.label);
 function cycleTheme(){setTheme(nextTheme.value);}
 const fontOptions=[{value:'small',label:'小号'},{value:'normal',label:'标准'},{value:'large',label:'大号'}];
 const fontIndex=$derived(Math.max(0,fontOptions.findIndex(item=>item.value===fontSize)));
 const fontHint=$derived('字号：'+fontOptions[fontIndex].label+'；点击切换为'+fontOptions[(fontIndex+1)%3].label);
 function cycleFont(){setFontSize(fontOptions[(fontIndex+1)%3].value);}
 function setMotion(value:boolean){reducedMotion=value;document.documentElement.dataset.motion=value?'reduced':'full';try{localStorage.setItem('motion',value?'reduced':'full');}catch{/* optional */}}
 onMount(()=>{try{const value=localStorage.getItem('theme');if(value&&['light','dark','system'].includes(value))setTheme(value);const savedBackdrop=localStorage.getItem('scene-background');if(savedBackdrop!==null)backdrop=savedBackdrop!=='false';document.documentElement.dataset.sceneBackground=String(backdrop);const motion=localStorage.getItem('motion');if(motion==='reduced')setMotion(true);const savedHue=localStorage.getItem('color-hue');if(savedHue&&Number.isFinite(Number(savedHue)))setHue(Number(savedHue));const savedFont=localStorage.getItem('font-size');if(savedFont&&['small','normal','large'].includes(savedFont))setFontSize(savedFont);}catch{/* optional */}return cancelClose;});
</script>
<svelte:window bind:scrollY onpointermove={pointerMoved} onkeydown={e=>{if(e.key==='Escape'){settingsOpen=false;moreOpen=false;}}} onpointerdown={e=>{if(settingsOpen&&!(e.target as Element)?.closest('#theme-colors,.color-trigger'))settingsOpen=false;}} />
<svelte:head><meta name="color-scheme" content="light dark" /></svelte:head>
<a class="skip" href="#public-main">跳到主要内容</a>
<header class="site-header" class:scene-header={showScene} class:over-scene={showScene && scrollY<sceneThreshold && !menuOpen}>
 <div class="nav-inner">
  <a class="brand-profile" href="/" aria-label={`${siteName}首页`}><img src="/images/makeine-anna.png" alt="八奈见杏菜头像" width="34" height="34" /><span class="brand-profile-copy"><strong>{siteName}</strong><small>记录、创作与小小日常</small></span></a>
  <nav class="desktop-nav" aria-label="主要导航">{#each links as [href,label,icon]}<a {href} class:active={isActive(href)} aria-current={isActive(href)?'page':undefined}><NavIcon name={icon}/>{label}</a>{/each}{#if tools}<a href="/tools" class:active={isActive('/tools')}><NavIcon name="tools"/>工具</a>{/if}<a href="/search" class:active={isActive('/search')}><NavIcon name="search"/>搜索</a>
  <div class="more-nav" role="group" onmouseenter={cancelClose} onmouseleave={()=>{cancelClose();closeTimer=setTimeout(()=>moreOpen=false,220)}}><button class="more-trigger" type="button" aria-expanded={moreOpen} onclick={()=>{cancelClose();moreOpen=!moreOpen}}><NavIcon name="more"/>更多</button>{#if moreOpen}<div id="more-links" class="menu">{#each extraLinks as [href,label,icon]}<a {href} onclick={()=>moreOpen=false}><NavIcon name={icon}/>{label}</a>{/each}</div>{/if}</div></nav>
  <div class="header-actions">
   <button class="icon-action font-cycle" type="button" aria-label={fontHint} title={fontHint} onclick={cycleFont}><NavIcon name="type"/></button>
   <button class="icon-action theme-cycle" type="button" aria-label={themeHint} title={themeHint} onclick={cycleTheme}><NavIcon name={currentTheme.icon}/></button>
   <button class="icon-action color-trigger" type="button" aria-label="主题颜色" title="主题颜色" aria-expanded={settingsOpen} aria-controls="theme-colors" onclick={()=>settingsOpen=!settingsOpen}><NavIcon name="palette"/></button>
   <button class="menu-toggle" type="button" aria-label={menuOpen?'关闭菜单':'打开菜单'} aria-expanded={menuOpen} aria-controls="mobile-menu" onclick={()=>menuOpen=!menuOpen}><NavIcon name="more"/></button>
  </div>
 </div>

 {#if settingsOpen}<div id="theme-colors" role="dialog" aria-label="主题颜色" tabindex="-1" class="color-popover"><div class="hue-heading"><label for="theme-hue">主题颜色</label><output>{hue}°</output></div><input id="theme-hue" class="hue-slider" type="range" min="0" max="360" step="1" value={hue} aria-label="主题色相" oninput={e=>setHue(Number(e.currentTarget.value))} /></div>{/if}
 {#if menuOpen}<nav id="mobile-menu" class="mobile-menu" aria-label="移动端导航">{#each [...links,...(tools?[['/tools','工具','tools']]:[]),['/search','搜索','search'],...extraLinks] as [href,label,icon]}<a {href} class:active={isActive(href)} onclick={()=>menuOpen=false}><NavIcon name={icon}/>{label}</a>{/each}</nav>{/if}
</header>
{#if showScene}<SceneBanner {siteName} {banner} mode={sceneMode === 'off' ? 'section' : sceneMode} sectionLabel={sceneLabel} sectionIcon={sceneIcon} />{/if}
<div class="public-shell" class:home-shell={home} class:plain-background={!backdrop} id="public-main">
 <PersonalSpace {siteName} {intro} {status} {socialLinks} />
 <div class="content-column">{@render children()}</div>
 <aside class="context-column"><ContextSidebar kind={home ? 'home' : contextKind} /></aside>
 <MusicPlayer />
</div>
<footer><div class="footer-inner"><p class="footer-signature">把好奇心写成记录，把过程留给以后。</p><nav aria-label="页脚导航"><a href="/articles">文章</a><a href="/notes">笔记</a><a href="/projects">作品</a><a href="/about">关于</a><a href="/rss.xml">RSS</a></nav><p class="muted">© {new Date().getFullYear()} {siteName}</p></div></footer>
<style>
:global(body:has(.public-shell)){background-color:var(--canvas);background-image:radial-gradient(color-mix(in srgb,var(--primary) 8%,transparent) 1px,transparent 1px);background-size:18px 18px}
:global(body:has(.public-shell.plain-background)){background-image:none}:global(html[data-scene-background='false'] body){background-image:none!important}
.site-header{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--canvas) 94%,var(--primary) 6%);border-bottom:1px solid color-mix(in srgb,var(--primary) 18%,var(--line))}.site-header.scene-header{position:fixed;inset:0 0 auto;background:transparent;border-bottom-color:transparent;box-shadow:none}.site-header.scene-header:not(.over-scene){background:var(--surface);border-bottom-color:var(--line);box-shadow:0 6px 24px #1d24420d}.site-header.over-scene{background:transparent;border-bottom-color:transparent;color:white;box-shadow:none}.nav-inner{position:relative;max-width:1320px;min-height:64px;margin:auto;padding:7px 22px;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;gap:16px}.brand-profile{display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;min-width:0}.brand-profile img{width:34px;height:34px;border-radius:50%;flex-shrink:0}.brand-profile-copy{display:grid;line-height:1.3;gap:2px}.brand-profile-copy strong{font-size:0.875rem}.brand-profile-copy small{font-size:0.625rem;color:var(--muted)}.over-scene .brand-profile-copy small{color:#e8eff6}.desktop-nav{display:flex;align-items:center;gap:1px}.desktop-nav a,.desktop-nav .more-trigger{position:relative;display:inline-flex;gap:4px;align-items:center;min-height:34px;padding:5px 8px;border-radius:7px;color:inherit;text-decoration:none;font-size:0.75rem}.desktop-nav a:hover,.desktop-nav .more-trigger:hover{color:var(--primary)}.desktop-nav a.active{background:transparent;color:var(--primary);box-shadow:none}.desktop-nav a::after,.desktop-nav .more-trigger::after{content:"";position:absolute;left:50%;bottom:0;width:0;height:2px;border-radius:99px;background:currentColor;transform:translateX(-50%);transition:width .2s ease}.desktop-nav a:hover::after,.desktop-nav .more-trigger:hover::after,.desktop-nav a.active::after{width:20px}.over-scene .desktop-nav a:hover,.over-scene .desktop-nav a.active{background:transparent;color:#fff;box-shadow:none}.more-nav{position:relative}.more-trigger{border:0;background:transparent;color:inherit;font-weight:inherit;cursor:pointer;list-style:none}.more-trigger::-webkit-details-marker{display:none}.menu{position:absolute;right:0;top:100%;z-index:30;display:grid;min-width:132px;padding:7px;background:var(--panel-bg);color:var(--text);text-shadow:none;border:1px solid var(--line);border-radius:11px;box-shadow:var(--shadow-sm)}.menu a{color:var(--text)!important}.color-popover{position:absolute;right:22px;top:66px;width:min(280px,calc(100vw - 32px));padding:14px 18px;background:var(--panel-bg);color:var(--text);border:1px solid color-mix(in srgb,var(--primary) 35%,var(--line));border-radius:18px;box-shadow:var(--shadow-md);z-index:31}.hue-heading{display:flex;justify-content:space-between;align-items:center}.hue-heading label{font-size:.8125rem;margin:0 0 10px}.hue-heading output{font-size:.6875rem;color:var(--primary)}.hue-slider{width:100%;height:16px;min-height:16px;padding:0;margin:0 0 4px;border:0;border-radius:999px;appearance:none;background:linear-gradient(90deg,#ef6b7d,#edbd55,#8bcf7b,#59c8ca,#719ef0,#b47de5,#ef6b7d)}.hue-slider::-webkit-slider-thumb{appearance:none;width:20px;height:20px;border-radius:50%;background:var(--surface-raised);border:3px solid var(--primary)}.header-actions{position:absolute;right:22px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:7px}.over-scene .menu-toggle{background:transparent;color:#fff;border-color:#ffffff55}.menu-toggle{display:none}.mobile-menu{display:none}
.public-shell{max-width:1320px;margin:auto;padding:22px 22px 56px;display:grid;grid-template-columns:220px minmax(0,820px) 210px;justify-content:center;gap:18px;align-items:start;min-height:75vh}.home-shell{position:relative;margin-top:0;padding-top:20px;z-index:4}.context-column{background:transparent;border:0;border-radius:0;overflow:hidden;position:sticky;top:92px;min-width:0}.content-column{min-width:0}.context-column{padding:8px 0 8px 20px;border-left:1px solid var(--line)}footer{border-top:1px solid var(--line)}.footer-inner{max-width:1440px;margin:auto;padding:24px;display:flex;justify-content:space-between;gap:24px;align-items:center;font-size:0.75rem;color:var(--muted)}.footer-inner p{margin:0}.footer-inner nav{display:flex;flex-wrap:wrap;gap:16px}.footer-inner a{text-decoration:none;color:inherit}.skip{position:fixed;left:16px;top:12px;transform:translateY(-200%);padding:12px 16px;background:var(--surface);border-radius:9px;z-index:40}.skip:focus{transform:none}:global(.public-shell){overflow-wrap:anywhere;scroll-margin-top:84px}:global(.public-shell :focus-visible){scroll-margin-block:84px}
@media(max-width:1180px){.public-shell{grid-template-columns:200px minmax(0,1fr) 190px;gap:14px;padding-inline:16px}.nav-inner{gap:12px}.desktop-nav a,.desktop-nav .more-trigger{padding-inline:8px}.brand-profile-copy small{display:none}}
@media(max-width:1060px){.brand-profile-copy small{display:none}.nav-inner{gap:8px}.desktop-nav a,.desktop-nav .more-trigger{padding-inline:6px}}
@media(max-width:1100px){.brand-profile-copy{display:none}}
@media(max-width:950px){.context-column{display:none}.public-shell{grid-template-columns:200px minmax(0,1fr)}}
@media(max-width:760px){.site-header,.site-header.scene-header{top:8px;inset-inline:8px;margin:0;border-radius:13px}.desktop-nav{display:none}.menu-toggle{display:block}.mobile-menu{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:9px 12px;gap:5px;background:var(--surface);border-top:1px solid var(--line);border-radius:0 0 13px 13px}.mobile-menu a{display:flex;align-items:center;gap:8px;padding:8px;text-decoration:none;color:var(--text);min-height:40px;font-size:0.8125rem}.mobile-menu a.active{background:var(--soft)}.nav-inner{padding-inline:10px;grid-template-columns:1fr auto}.public-shell{display:block;padding:18px 13px 36px}.home-shell{padding-top:16px;margin-top:0}.brand-profile-copy strong{font-size:0.8125rem}.footer-inner{flex-wrap:wrap;padding:22px 16px;gap:12px}.footer-signature{width:100%}}
.icon-action{display:inline-grid;place-items:center;flex:0 0 40px;width:40px;height:40px;min-height:40px;padding:0;border:0;border-radius:50%;background:transparent;color:inherit}
.icon-action:hover{background:var(--soft);color:var(--primary)}.over-scene .icon-action:hover{background:#ffffff22;color:white}
@media(max-width:760px){.header-actions{right:10px;gap:2px}.color-popover{right:8px}}
</style>
