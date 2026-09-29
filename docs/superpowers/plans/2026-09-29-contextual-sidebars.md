# Contextual Sidebars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将公开站点改为“左栏个人空间、中央内容、右栏页面上下文”的统一布局，减少重复卡片和导航，并在首页、详情、列表、搜索及移动端保持一致行为。

**Architecture:** 保留 `PublicLayout` 作为外壳，但把身份区、页面上下文、正文目录拆成职责单一的组件。服务端页面继续提供公开数据，客户端只做展示适配；右栏通过显式 `contextKind` 和上下文数据渲染，首页才挂载课表。音乐只保留一个播放器实例，侧栏摘要通过共享控制接口打开它。

**Tech Stack:** Svelte 5 runes, SvelteKit 2, TypeScript, existing PostgreSQL public queries, Vitest, svelte-check, Playwright/browser verification.

**Spec:** `docs/superpowers/specs/2026-09-29-contextual-sidebars-design.md`

## Global Constraints

- 顶栏保留唯一完整栏目导航，侧栏不重复栏目入口。
- 无有效上下文时省略模块，不创建假数据或占位卡片。
- 课表只显示课程名称、日期和时间，仅首页挂载；不显示教师、地点或 ICS 原文。
- 只查询当前已公开版本，不读取草稿或工作区数据。
- 不删除数据库、媒体、备份、目录或批量文件；不推送远程。
- 颜色、字号、深浅色和减少动态设置必须兼容现有语义变量。
- 音乐不自动播放，公共外壳内只能有一个音频实例。

## Review Focus

- 路由从详情页切换到列表页时，目录、系列和相关文章不能残留；由 Task 3 的路由上下文测试覆盖。
- 首页以外不能出现课表；由 Task 2 的渲染测试覆盖。
- 正文没有 h2/h3、重复标题或短于视口时，目录和阅读进度应省略或稳定降级；由 Task 3 的目录测试覆盖。
- 音乐服务为空、失败或跨路由切换时不能产生重复音频；由 Task 4 的播放器测试覆盖。
- 搜索无关键词、无结果、分页越界和宽窄屏筛选布局必须保持真实状态；由 Task 5 的搜索测试覆盖。

### Task 1: Extract the continuous personal-space sidebar

**Files:**
- Create: `src/lib/components/public/PersonalSpace.svelte`
- Modify: `src/lib/components/public/PublicLayout.svelte`
- Modify: `src/lib/server/workspace/identity.ts` only if existing public identity type lacks optional status/social fields
- Test: `tests/unit/public/personal-space.test.ts` (component contract or pure adapter tests)

**Interfaces:**
- Consumes: `siteName`, `intro`, `banner` and optional configured status/social links from public identity.
- Produces: one accessible `PersonalSpace` component with identity, optional status, configured links, and an `onOpenPlayer` callback; no repeated section navigation.

- [ ] **Step 1: Add failing adapter tests** for missing status/links (module renders no empty rows), configured links (only configured links render), and accessible labels.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/public/personal-space.test.ts -v`; confirm the new contract fails before implementation.
- [ ] **Step 3: Implement** `PersonalSpace.svelte` as a continuous layout using existing image and semantic theme variables; keep status optional and omit unconfigured links.
- [ ] **Step 4: Replace** the inline `.space-sidebar` markup in `PublicLayout.svelte` with `PersonalSpace`, preserving the current identity and banner inputs.
- [ ] **Step 5: Run** the focused test and `pnpm check`; expected PASS with no new Svelte diagnostics.
- [ ] **Step 6: Commit** `feat(public): 重组个人空间侧栏`.

### Task 2: Define page-context data and render dynamic right sidebar

**Files:**
- Create: `src/lib/components/public/context.ts`
- Modify: `src/lib/components/public/ContextSidebar.svelte`
- Modify: `src/lib/components/public/PublicLayout.svelte`
- Modify: public route layouts/pages that currently load list/detail/collection data, only where needed to pass context data
- Test: `tests/unit/public/context.test.ts`

**Interfaces:**
- Consumes: `ContextKind = 'home' | 'listing' | 'detail' | 'collection' | 'search' | 'static'`, `PublicRow`, existing navigation/series/list/collection data.
- Produces: `buildContext(kind, data): ContextModel`, where `ContextModel` contains ordered optional groups (`schedule`, `directory`, `series`, `related`, `summary`, `updates`) and never fabricates counts.

- [ ] **Step 1: Write failing tests** for home schedule flag, detail series/related de-duplication, empty-context omission, and search exclusion of the global sidebar.
- [ ] **Step 2: Run** the focused context tests and verify failure.
- [ ] **Step 3: Implement** typed context models and a pure adapter in `context.ts`; use public href helpers and stable content IDs for de-duplication.
- [ ] **Step 4: Update** `ContextSidebar.svelte` to render at most three real groups with lightweight separators, and mount `ScheduleWidget` only when `kind === 'home'`.
- [ ] **Step 5: Update** `PublicLayout.svelte` and route callers to pass context data; remove duplicated generic `BROWSE/SPACE` and unconditional schedule output.
- [ ] **Step 6: Add responsive disclosure markup** for 761–1099px and mobile so hidden right-column context remains available once, without rendering duplicate focusable controls.
- [ ] **Step 7: Run** focused tests and `pnpm check`; expected PASS.
- [ ] **Step 8: Commit** `refactor(public): 按页面提供上下文侧栏`.

### Task 3: Add article outline and reading progress

**Files:**
- Create: `src/lib/components/public/ReadingContext.svelte`
- Modify: `src/lib/components/public/Detail.svelte`
- Modify: `src/lib/components/editor/MarkdownPreview.svelte` only if a stable heading-anchor hook is required
- Test: `tests/unit/public/reading-context.test.ts`

**Interfaces:**
- Consumes: sanitized rendered article HTML and `PublicDetailNavigation`.
- Produces: `ReadingContext` with unique h2/h3 anchors, current-section state, bounded progress, series/adjacent/related links; mobile relocation uses the same data once.

- [ ] **Step 1: Write failing tests** for no headings, duplicate heading text, bounded progress, and series-neighbor de-duplication.
- [ ] **Step 2: Run** the focused tests and verify failure.
- [ ] **Step 3: Implement** heading extraction from sanitized content, deterministic slug suffixes, scroll-margin-aware links, and a progress calculation limited to the reading region.
- [ ] **Step 4: Replace** duplicate navigation blocks in `Detail.svelte` with `ReadingContext`; keep comments at the end and preserve existing public links.
- [ ] **Step 5: Run** focused tests, `pnpm check`, and a long-detail browser check at 1440px/390px; expected one outline and one navigation group per viewport.
- [ ] **Step 6: Commit** `feat(public): 增加正文目录与阅读进度`.

### Task 4: Share one music player between sidebar and floating entry

**Files:**
- Create: `src/lib/components/public/music-context.ts`
- Modify: `src/lib/components/public/MusicPlayer.svelte`
- Modify: `src/lib/components/public/PersonalSpace.svelte`
- Modify: `src/lib/components/public/PublicLayout.svelte`
- Test: `tests/unit/public/music-context.test.ts`

**Interfaces:**
- Produces: a client-only `MusicController` with `tracks`, `currentIndex`, `playing`, `error`, `toggle`, `next`, `select`, and `open`; no server-shared audio state.
- Consumes: existing `/api/music/playlist` response and current theme tokens.

- [ ] **Step 1: Write failing tests** for empty playlist, fetch failure, one controller per public shell, and index wraparound.
- [ ] **Step 2: Run** the focused tests and verify failure.
- [ ] **Step 3: Implement** the controller/context and make `MusicPlayer` consume it without autoplay.
- [ ] **Step 4: Add** the compact “正在播放” summary to `PersonalSpace`; hide the floating orb when the desktop sidebar summary is visible and retain it for mobile.
- [ ] **Step 5: Run** focused tests, `pnpm check`, and browser checks for route navigation and the player panel; expected no duplicate `<audio>` elements.
- [ ] **Step 6: Commit** `refactor(public): 共享音乐播放器状态`.

### Task 5: Redesign search workspace and finish responsive/public-shell polish

**Files:**
- Modify: `src/routes/search/+page.svelte`
- Modify: `src/lib/components/public/PublicLayout.svelte`
- Modify: `src/lib/components/public/ContextSidebar.svelte`
- Test: `tests/unit/public/search-layout.test.ts` and existing search tests

**Interfaces:**
- Consumes: existing search URL parameters and `SearchPage` server result.
- Produces: wide layout with filter rail and two-column results, one-column fallback based on available width, mobile disclosure, and no duplicate global right sidebar.

- [ ] **Step 1: Write failing tests** for preserving query/type/tag/page parameters, no-keyword state, zero-result state, and pagination links.
- [ ] **Step 2: Run** focused search tests and verify failure.
- [ ] **Step 3: Implement** the filter rail/result grid and a compact visual system using existing tokens; keep form semantics and server query behavior unchanged.
- [ ] **Step 4: Remove** search-specific duplicate context from `PublicLayout` while retaining the single music entry and top navigation.
- [ ] **Step 5: Run** `pnpm check`, `pnpm test`, and browser checks for home, listing, detail, project detail, series, search and about at 1440px, 1024px and 390px with light/dark/yellow themes and large font.
- [ ] **Step 6: Review** `git diff`, inspect retained-file status, run the repository’s retained verification/build command after checking its deletion behavior, then build and update the local web service with the approved non-cleaning compose commands.
- [ ] **Step 7: Commit** `feat(public): 完成动态侧栏与搜索布局` and verify `git status` is clean. Do not push remote.

## Final Verification

Run `pnpm check`, `pnpm test`, and the relevant browser checks. Confirm the deployed page at `http://127.0.0.1:5181/` on every listed route, verify no database/media/backup files changed, and report any unavailable real data instead of inventing it.
