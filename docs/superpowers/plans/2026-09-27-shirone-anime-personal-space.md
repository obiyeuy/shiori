# Shirone 风格二次元个人空间实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 personal-site 全站改造成以 Shirone 为主参考、带八奈见杏菜本机验证素材的二次元个人空间，并在 5181 完成可视验收。

**Architecture:** 保留现有 SvelteKit 路由、查询、认证、数据库和媒体接口，只重构视觉令牌、公开布局和各页面展示组件。通过 `PublicLayout` 提供统一个人空间壳层，以页面类型分流不同内容布局；登录和工作台复用令牌但不共享公开内容结构。

**Tech Stack:** Svelte 5、SvelteKit 2、TypeScript、CSS、Vite、Docker Compose。

**Spec:** `docs/superpowers/specs/2026-09-27-shirone-anime-personal-space-design.md`

## Global Constraints

- 保留公开 URL、数据库 schema、认证、评论、媒体权限和内容查询。
- 保留数据库、媒体、备份、《千与千寻》素材和旧提交回退分支。
- 本机验证可使用八奈见杏菜官方素材，复制到本地静态目录并记录来源，不热链。
- 不批量删除文件，不删除目录，不清理数据库、媒体、备份或旧镜像。
- 不推送远程；最终部署到 `http://127.0.0.1:5181/`。
- 动效遵守 `prefers-reduced-motion`，图片失败必须有可见替代。

## Review Focus

- 无封面作品：应显示有设计感的色块占位和首字，而不是破图或空白；由任务 4 测试/验收覆盖。
- 八奈见素材加载失败：应保留场景结构并显示来源/替代文案；由任务 2 测试/验收覆盖。
- 移动端长站名与导航：应收进抽屉且不横向溢出；由任务 3 验收覆盖。
- 深色主题的蓝粉黄强调色：正文和按钮仍需可读；由任务 1 验收覆盖。
- 真实内容数量较少：栏目应保持节奏，不用新增占位卡片；由任务 4 验收覆盖。

### Task 1: 主题令牌与本机素材

**Files:**
- Modify: `src/lib/components/ui/tokens.css`
- Modify: `src/app.html`
- Modify: `static/images/SOURCES.md`
- Create: `static/images/makeine-anna-hero.*`（从已确认官方素材中选择实际文件名）

**Interfaces:**
- Produces CSS variables for light/dark surfaces, lavender canvas, Shirone-style accent colors, panel radii, shadows and type scale.

- [ ] **Step 1: Record the selected local素材来源 and intended role in `static/images/SOURCES.md`.**
- [ ] **Step 2: Add the local image file without removing existing media.**
- [ ] **Step 3: Update token variables and base font stack while preserving existing semantic variable names.**
- [ ] **Step 4: Run `pnpm check` and verify no token consumer is undefined.**
- [ ] **Step 5: Commit `feat(ui): 建立 Shirone 主题令牌与本机素材`.**

### Task 2: 公开站壳层与个人空间导航

**Files:**
- Modify: `src/lib/components/public/PublicLayout.svelte`
- Modify: `src/lib/components/public/Comments.svelte` only if token/class compatibility requires it

**Interfaces:**
- Consumes existing `children`, `tools`, `siteName` props and current page pathname.
- Produces desktop personal sidebar, mobile drawer, scene-aware header, theme control, footer and accessible focus behavior.

- [ ] **Step 1: Add a shell-level render check for nav links, active state, theme control and mobile menu labels.**
- [ ] **Step 2: Implement the desktop Shirone-style personal sidebar using existing navigation and identity data only.**
- [ ] **Step 3: Implement the mobile drawer and verify focus return, skip link and no horizontal overflow.**
- [ ] **Step 4: Replace generic header/footer styling with the new tokens without changing link destinations.**
- [ ] **Step 5: Run `pnpm check` and the relevant unit tests.**
- [ ] **Step 6: Commit `feat(ui): 重构公开站个人空间壳层`.**

### Task 3: 首页场景与公开栏目布局

**Files:**
- Modify: `src/routes/(public)/+page.svelte`
- Modify: `src/lib/components/public/Listing.svelte`
- Modify: `src/lib/components/public/ContentList.svelte`
- Modify: `src/routes/(public)/projects/+page.svelte`
- Modify: `src/routes/(public)/moments/+page.svelte`
- Modify: `src/routes/(public)/tools/+page.svelte`
- Modify: `src/routes/(public)/resources/+page.svelte`

**Interfaces:**
- Consumes existing `data.items`, pagination, tags and public row payloads.
- Produces page-specific variants: article/note flow, moment timeline, project showcase, tool/resource directory.

- [ ] **Step 1: Add assertions for existing item counts and public hrefs so redesign does not create placeholder content.**
- [ ] **Step 2: Implement the home scene hero with local Anna image, visible fallback, credit line and one panel overlap.**
- [ ] **Step 3: Implement the home sections for status, latest updates, featured content, projects and tools using existing data.**
- [ ] **Step 4: Add `variant`-based list layouts and remove the one-size-fits-all presentation from project/moment/tool/resource pages.**
- [ ] **Step 5: Verify desktop/mobile screenshots for `/`, `/articles`, `/notes`, `/moments`, `/projects`, `/tools`, `/resources`.**
- [ ] **Step 6: Commit `feat(ui): 设计首页与公开栏目布局`.**

### Task 4: 详情、探索、关于与搜索视觉统一

**Files:**
- Modify: `src/lib/components/public/Detail.svelte`
- Modify: `src/routes/(public)/tags/+page.svelte`
- Modify: `src/routes/(public)/series/+page.svelte`
- Modify: `src/routes/(public)/about/+page.svelte`
- Modify: `src/routes/search/+page.svelte`

**Interfaces:**
- Consumes existing detail navigation, search result and index data.
- Produces readable content panel, metadata, related navigation, exploration directories and themed search states.

- [ ] **Step 1: Add checks for detail canonical URL, related links, empty comments state and search noindex behavior.**
- [ ] **Step 2: Implement the detail reading panel with optional cover, readable measure, series/up-next navigation and comments boundary.**
- [ ] **Step 3: Give tags and series an exploration index treatment with counts and clear return paths.**
- [ ] **Step 4: Rework about and search pages to share scene header, filter chips and empty/error states.**
- [ ] **Step 5: Verify `/articles/local-demo-1`, `/tags`, `/series`, `/about`, `/search` in both themes.**
- [ ] **Step 6: Commit `feat(ui): 统一详情与探索页面视觉`.**

### Task 5: 登录与工作台统一主题

**Files:**
- Modify: `src/routes/login/+page.svelte`
- Modify: `src/routes/workspace/+layout.svelte`
- Modify: `src/routes/workspace/+page.svelte` only if overview needs visual composition

**Interfaces:**
- Consumes existing auth form, workspace navigation and children snippets.
- Produces scene-backed login focus and Shirone-compatible workspace navigation without changing auth or permissions.

- [ ] **Step 1: Add checks that login retains password/GitHub actions and workspace retains every existing navigation link.**
- [ ] **Step 2: Implement login scene background, focused panel and visible fallback without exposing private data.**
- [ ] **Step 3: Apply theme tokens, status labels, panel hierarchy and mobile drawer to workspace layout.**
- [ ] **Step 4: Verify keyboard focus, reduced motion and long navigation labels.**
- [ ] **Step 5: Commit `feat(ui): 统一登录与工作台主题`.**

### Task 6: 全站验证与本机部署

**Files:**
- Modify: `ops/site.sh` only if needed to avoid automatic old-image removal during this deployment
- Create: retained verification output under `.local/verification/` only

**Interfaces:**
- Consumes all prior UI tasks and current `.local/site.env`.
- Produces verified running container at `127.0.0.1:5181` and evidence for final report.

- [ ] **Step 1: Run `pnpm check`, `pnpm lint`, `pnpm test:unit`, and `pnpm build`; stop on failure.**
- [ ] **Step 2: Build the web image with the existing compose project, preserving DB volume and media mount.**
- [ ] **Step 3: Start/recreate only `personal-site-web` and verify health at `127.0.0.1:5181`; do not remove old images or volumes.**
- [ ] **Step 4: Browser-check all public routes, login, workspace shell, mobile viewport, dark mode and image fallback.**
- [ ] **Step 5: Inspect `git diff`, staged diff and status; commit only task-related changes.**
- [ ] **Step 6: Commit `chore(deploy): 验证 Shirone 视觉部署`.**
