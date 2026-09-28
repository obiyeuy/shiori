# 公开站壳层、搜索与音乐播放器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将公开站收敛为职责不重复的个人空间壳层，重做搜索与 banner 过渡，并通过服务端代理接入 Navidrome 音乐播放器。

**Architecture:** 保留现有 SvelteKit 公开路由与数据库查询；公共布局只负责身份、导航和响应式列，右栏通过页面上下文 props 渲染。新增服务端 Navidrome 客户端和公开代理端点，前端播放器只消费本站安全接口。静态 Favicon 资产由同一 SVG 源生成并在根布局声明。

**Tech Stack:** Svelte 5、SvelteKit、TypeScript、CSS、SVG/PNG、Vitest、Docker Compose、Navidrome Subsonic API。

**Spec:** `docs/superpowers/specs/2026-09-28-public-shell-music-design.md`

## Global Constraints

- Favicon 不使用八奈见杏菜或任何角色图片，使用抽象“开放窗口 + 四点星芒”标志。
- 音乐服务地址为 `http://49.233.199.110:4533`；凭据只存在服务端环境变量，不进入前端、Git 或提交记录。
- 播放器不自动播放；上游不可用时显示稳定的可读错误。
- 保留数据库、媒体、备份和服务器音乐文件；不执行删除、清理或远程推送。
- 保留现有公开查询语义和搜索参数 `q`、`type`、`tag`、`page`。

## Review Focus

- Navidrome 未配置凭据或上游超时时，页面仍可加载且播放器显示错误状态；Task 4 测试。
- 音频 Range 请求和断点播放不能被代理吞掉；Task 4 测试。
- 移动端播放器不能遮挡正文或底部操作；Task 3 测试。
- 场景关闭与 reduced-motion 同时启用时不能渲染或动画波浪；Task 3 测试。
- 搜索无关键词、零结果、错误和超页时仍保留可操作入口；Task 3 测试。

### Task 1: Favicon 与站点元信息

**Files:**
- Create: `static/favicon.svg`
- Create: `static/favicon-32.png`
- Create: `static/apple-touch-icon.png`
- Create: `static/site.webmanifest`
- Modify: `src/routes/+layout.svelte` 或现有根布局 head
- Test: `tests/unit/site-meta.test.ts`

**Interfaces:**
- Produces static assets and head links for `icon`, `shortcut icon`, `apple-touch-icon`, and `manifest`.

- [ ] **Step 1: Write the failing test** — assert root head references all four assets and SVG contains the abstract window/star mark without character image paths.
- [ ] **Step 2: Run test to verify it fails** — `pnpm test:unit -- tests/unit/site-meta.test.ts`; expected failure because assets/head links are absent.
- [ ] **Step 3: Implement assets and metadata** — create one SVG source with purple/yellow gradient, generate PNG derivatives without adding a new runtime dependency, and add metadata links.
- [ ] **Step 4: Run test and metadata check** — test passes; verify files exist and `pnpm check` has no diagnostics.
- [ ] **Step 5: Commit** — `feat(site): 增加抽象站点图标与元信息`.

### Task 2: 公共侧栏职责重组

**Files:**
- Create: `src/lib/components/public/ContextSidebar.svelte`
- Modify: `src/lib/components/public/PublicLayout.svelte`
- Modify: `src/routes/(public)/+layout.svelte`
- Test: `tests/unit/public-sidebar.test.ts`

**Interfaces:**
- `ContextSidebar` props: `{kind:'home'|'listing'|'detail'|'search'; nowPlaying?:TrackSummary|null; filters?:{q:string;types:string[];tags:string[]}; related?:PublicRow[]; series?:PublicDetailNavigation['series']|null}`.
- `PublicLayout` keeps existing props and adds optional `context?: ContextSidebarProps`.

- [ ] **Step 1: Write the failing test** — assert left sidebar contains identity/navigation only, right sidebar renders page context, and duplicated stats/quick-links/status blocks are absent.
- [ ] **Step 2: Run test to verify it fails** — `pnpm test:unit -- tests/unit/public-sidebar.test.ts`; expected failure against current duplicated blocks.
- [ ] **Step 3: Implement `ContextSidebar` and layout wiring** — remove repeated utility sections, pass route-specific context from public layout/pages, leave right column empty when no real context exists, and use a mobile bottom slot for the player only.
- [ ] **Step 4: Verify responsive behavior** — test sidebar structure and run `pnpm check`; inspect 1440px, 1024px and 390px for no horizontal overflow.
- [ ] **Step 5: Commit** — `refactor(public): 重组左右侧栏职责`.

### Task 3: 搜索工作区与 banner 波浪

**Files:**
- Modify: `src/routes/search/+page.svelte`
- Modify: `src/lib/components/public/SceneBanner.svelte`
- Modify: `src/lib/components/ui/tokens.css`
- Test: `tests/unit/public-search-scene.test.ts`

**Interfaces:**
- Search keeps current `data.input`, `data.result`, `data.tags`, and GET parameter behavior.
- `SceneBanner` retains `{siteName,banner,mode,sectionLabel,sectionIcon}` and renders at most two wave paths.

- [ ] **Step 1: Write the failing test** — assert search uses `search-workspace`, has cross-column query form plus filter/result regions, preserves no-query and zero-result actions, and scene markup has one primary plus one low-opacity wave with reduced-motion rules.
- [ ] **Step 2: Run test to verify it fails** — `pnpm test:unit -- tests/unit/public-search-scene.test.ts`; expected failure against current single-column search and wave CSS.
- [ ] **Step 3: Implement search workspace** — create compact top query row, desktop filter/result grid, mobile stacked layout, real tag/category links for empty query, and remove decorative orbit/large heading treatment.
- [ ] **Step 4: Implement wave transition** — use asymmetric curves with separate baselines, low-frequency reverse drift, reduced amplitude for section/detail modes, and no negative overlap.
- [ ] **Step 5: Run tests and lint** — targeted tests, `pnpm check`, `pnpm lint` pass.
- [ ] **Step 6: Commit** — `refactor(public): 重做搜索工作区与场景过渡`.

### Task 4: Navidrome 服务端代理与播放器

**Files:**
- Create: `src/lib/server/music/navidrome.ts`
- Create: `src/routes/api/music/playlist/+server.ts`
- Create: `src/routes/api/music/stream/[id]/+server.ts`
- Create: `src/lib/components/public/MusicPlayer.svelte`
- Modify: `src/lib/components/public/PublicLayout.svelte`
- Modify: `.env.example`
- Test: `tests/unit/navidrome.test.ts`

**Interfaces:**
- `NavidromeClient.listSongs(): Promise<TrackSummary[]>` where `TrackSummary = {id:string;title:string;artist:string;album?:string;duration?:number;streamUrl:string}`.
- `NavidromeClient.stream(id:string, request:Request): Promise<Response>` forwards safe Range/conditional headers and never exposes upstream credentials.
- `GET /api/music/playlist` returns `{items:TrackSummary[]}` or `{error:string}`.
- `GET /api/music/stream/:id` returns audio bytes/range response or JSON error.
- `MusicPlayer` consumes only those local endpoints and never autoplay.

- [ ] **Step 1: Write the failing tests** — cover missing env, upstream failure, playlist sanitization, Range forwarding, and player non-autoplay markup.
- [ ] **Step 2: Run tests to verify they fail** — `pnpm test:unit -- tests/unit/navidrome.test.ts`; expected missing module/routes.
- [ ] **Step 3: Implement Navidrome client** — use server-only env `NAVIDROME_URL`, `NAVIDROME_USER`, `NAVIDROME_PASSWORD`, Subsonic-compatible authentication, timeout, sanitized track mapping, and stream proxy.
- [ ] **Step 4: Implement routes and player** — add stable JSON errors, audio response headers, compact desktop context rendering, mobile fixed-bottom player with safe body padding, play/pause/progress/volume/queue controls.
- [ ] **Step 5: Run tests and static checks** — targeted tests, full `pnpm test:unit`, `pnpm check`, `pnpm lint` pass.
- [ ] **Step 6: Commit** — `feat(music): 增加 Navidrome 代理播放器`.

### Task 5: 部署与全站验收

**Files:**
- Modify: none unless validation finds a defect
- Test: `scripts/verify-retained.mjs`, public route smoke checks

- [ ] **Step 1: Run complete verification** — `pnpm test:unit`, `pnpm check`, `pnpm lint`, `pnpm build`.
- [ ] **Step 2: Deploy without cleanup** — `sh ops/site.sh deploy`; verify web/db containers healthy and port `127.0.0.1:5181`.
- [ ] **Step 3: Browser/HTTP review** — inspect home, listings, details, search and mobile; verify favicon response, context sidebars, wave spacing, music failure state, no console errors and no overflow.
- [ ] **Step 4: Retained-data check** — `node scripts/verify-retained.mjs --tests --build`; do not delete volumes, media, backups or old artifacts.
- [ ] **Step 5: Commit final fixes only if needed** — use the smallest focused Conventional Commit and re-run affected checks.
