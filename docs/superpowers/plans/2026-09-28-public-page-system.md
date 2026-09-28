# 公开站场景与栏目系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将公开站统一为“首页宽场景、内页窄场景、栏目分型、搜索双栏”的个人空间系统，并在本地 5181 完成视觉与交互验收。

**Architecture:** 保留现有 SvelteKit 路由、数据库查询、认证、媒体接口和公开权限过滤。重构 `PublicLayout` 负责全站场景、导航、侧栏和设置；拆分列表展示组件承担文章、笔记、动态、作品、目录的不同内容形态；详情和搜索分别使用同一公共壳层下的专用头部与工作区。

**Tech Stack:** Svelte 5、SvelteKit、TypeScript、CSS、Vitest、Playwright（仓库已有依赖）、Docker Compose。

**Spec:** `docs/superpowers/specs/2026-09-28-public-page-system-design.md`

## Global Constraints

- 首页场景高度为 60–65vh；栏目页场景为桌面 260px、手机 200px；详情页场景为桌面 220px、手机 180px。
- 正文在场景结束后保留 16–24px 距离，不用负外边距遮住波浪。
- 波浪最多两层，使用不同垂直基线与相位，慢速连续平移；减少动效时静止。
- 普通站内导航及列表取消逐项圆形右上箭头；只有外链、打开工具、分页等保留方向提示。
- 全站宽屏三栏，中屏收起右栏，手机收起两侧栏；禁止横向溢出。
- 场景开关、主题和减少动效状态跨刷新与站内导航保持；设置支持鼠标移出、点击外部和 Escape 收回。
- 保留数据库、媒体、备份、现有素材和回退提交；不推送远程，不执行递归或批量删除。

## Review Focus

- 页面切换到任意内页时，banner 模式、焦点和导航状态必须同步；测试公共布局在首页、栏目和详情路径下的模式选择。
- 场景开关关闭时，场景、纹理和波浪都必须消失；刷新后仍关闭；测试本地存储恢复。
- 真实数据为空或缺少封面时，页面必须显示空状态或文字布局，不生成大号占位卡；测试列表变体空数据。
- 搜索查询错误、零结果、超页和带筛选分页必须保留 GET 参数并给出可操作反馈；测试搜索工作区状态。
- 鼠标/键盘离开更多菜单和设置面板必须收回，焦点在面板内移动时不能误关闭；测试 pointer、Escape 和 focus 行为。

### Task 1: 公共场景、导航与壳层

**Files:**
- Modify: `src/lib/components/public/PublicLayout.svelte`
- Modify: `src/lib/components/public/SceneBanner.svelte`
- Modify: `src/lib/components/public/NavIcon.svelte`
- Modify: `src/lib/components/ui/tokens.css`
- Test: `tests/unit/public-layout.test.ts`（若现有测试组织不同，放入现有 public 组件测试文件）

**Interfaces:**
- Produces `SceneBanner` props `{siteName, banner, mode: 'home'|'section'|'detail', sectionLabel?, sectionIcon?}`。
- Produces公共壳层根据当前 pathname 选择场景模式和三栏响应式布局。
- 保留 `NavIcon` 的名称接口，补齐 home、search、settings、栏目和主题图标。

- [ ] **Step 1: 写失败测试**：断言首页使用 `home` 场景高度、栏目页使用 `section` 场景、详情页使用 `detail` 场景；断言关闭场景后 DOM 中无场景与波浪，并刷新状态可恢复。
- [ ] **Step 2: 运行对应测试确认失败**：使用仓库现有 Vitest 配置运行新增测试，记录缺少模式 prop 或状态行为的失败。
- [ ] **Step 3: 实现场景模式与公共壳层**：将 banner 高度、文字密度、波浪高度和正文间距收进模式 CSS；波浪最多两层，按不同 `y` 基线渲染，使用低幅度 `translate3d`；导航保持居中透明/纯色切换，不使用磨砂；设置面板只保留主题、全站场景、减少动效。
- [ ] **Step 4: 实现菜单收回与状态恢复**：更多菜单支持 hover/focus/键盘，设置支持点击外部、鼠标移出延迟和 Escape；所有状态写入 localStorage 并在 onMount 恢复。
- [ ] **Step 5: 运行测试与检查**：对应测试通过，`pnpm check` 无 warning；检查 1440、1024、390px 的场景 bounding box 和无横向溢出。
- [ ] **Step 6: 提交**：`git add` 仅加入公共壳层、场景、图标和测试，提交 `feat(public): 统一场景导航与响应式壳层`。

### Task 2: 栏目页分型与箭头收敛

**Files:**
- Modify: `src/lib/components/public/Listing.svelte`
- Modify: `src/lib/components/public/ContentList.svelte`
- Create: `src/lib/components/public/ArticleList.svelte`
- Create: `src/lib/components/public/NoteGrid.svelte`
- Create: `src/lib/components/public/MomentTimeline.svelte`
- Create: `src/lib/components/public/DirectoryList.svelte`
- Modify: `src/routes/(public)/articles/+page.svelte`
- Modify: `src/routes/(public)/notes/+page.svelte`
- Modify: `src/routes/(public)/moments/+page.svelte`
- Modify: `src/routes/(public)/projects/+page.svelte`
- Modify: `src/routes/(public)/tools/+page.svelte`
- Modify: `src/routes/(public)/resources/+page.svelte`
- Test: `tests/unit/public-listing.test.ts`

**Interfaces:**
- Each variant consumes existing `PublicRow[]` and emits accessible links without nested anchors.
- `ArticleList` uses `items: PublicRow[]`; `NoteGrid` uses `items: PublicRow[]`; `MomentTimeline` uses `items: PublicRow[]`; `DirectoryList` uses `items: PublicRow[]` and `kind: 'tool'|'resource'`.
- `Listing` retains pagination, selected tags and SEO data but delegates visual rendering to the variant component.

- [ ] **Step 1: 写失败测试**：给每个变体断言唯一结构：文章分隔流、笔记双列 class、动态时间轴轨道、目录状态/外链；断言普通条目没有圆形箭头。
- [ ] **Step 2: 运行测试确认失败**：运行 `pnpm test:unit -- tests/unit/public-listing.test.ts`，确认当前共享列表无法满足结构断言。
- [ ] **Step 3: 实现栏目组件**：将 `Listing` 的巨大标题改为窄 banner 下的紧凑栏目头；文章突出第一条，笔记双列，动态按日期轨道，作品使用真实封面，工具/资源使用目录行；缺少封面时使用文字布局，不生成大字母占位图。
- [ ] **Step 4: 收敛方向符号**：移除 `ContentList` 普通行的圆形右箭头；保留外链或打开动作的单个图标，并用整行 hover/左边界表达可点击性。
- [ ] **Step 5: 运行测试与 lint**：变体测试、`pnpm check`、`pnpm lint` 通过；逐页确认桌面两栏/三栏和移动单列。
- [ ] **Step 6: 提交**：`feat(public): 拆分栏目内容形态`。

### Task 3: 详情页、索引页与搜索工作区

**Files:**
- Modify: `src/lib/components/public/Detail.svelte`
- Modify: `src/lib/components/public/Listing.svelte`（只保留公共分页/筛选接口）
- Modify: `src/routes/search/+page.svelte`
- Modify: `src/routes/(public)/tags/+page.svelte`
- Modify: `src/routes/(public)/series/+page.svelte`
- Modify: `src/routes/(public)/about/+page.svelte`
- Modify: `src/routes/(public)/privacy/+page.svelte`
- Test: `tests/unit/public-detail-search.test.ts`

**Interfaces:**
- `Detail` 保留现有 `item`, `giscus`, `navigation` 接口，增加详情场景标签而不改变数据读取。
- 搜索沿用现有 `q`, `type`, `tag`, `page` GET 参数及 `SearchPage` 返回类型。

- [ ] **Step 1: 写失败测试**：断言详情页不重复显示栏目大标题；搜索桌面存在条件栏与结果栏，零结果/错误/超页可操作；标签和系列显示真实数量。
- [ ] **Step 2: 实现详情阅读头部**：使用返回路径、类型日期、内容标题、摘要、封面/正文的窄 banner + 阅读头部；保留 Markdown、评论、相关内容和安全链接行为。
- [ ] **Step 3: 实现搜索双栏**：搜索框跨工作区，桌面左侧筛选、右侧结果，窄屏折叠到顶部；无关键词只展示现有标签和栏目入口，不编造热门数据。
- [ ] **Step 4: 改造索引与关于/隐私**：统一使用窄场景和文档式内容节奏，去除重复大标题卡；保留已有真实文案和链接。
- [ ] **Step 5: 运行测试与 lint**：`pnpm test:unit -- tests/unit/public-detail-search.test.ts`、`pnpm check`、`pnpm lint` 通过。
- [ ] **Step 6: 提交**：`feat(public): 重构详情索引与搜索布局`。

### Task 4: 首页与面板视觉层次

**Files:**
- Modify: `src/routes/(public)/+page.svelte`
- Modify: `src/lib/components/public/PublicLayout.svelte`
- Modify: `src/lib/components/ui/tokens.css`
- Test: `tests/unit/public-home-visual.test.ts`

**Interfaces:**
- 首页继续消费现有 `data.identity`, `updates`, `featured`, `projects`, `tools`。
- 公共壳层继续提供三栏和设置状态，首页仅负责内容顺序和分区。

- [ ] **Step 1: 写失败测试**：断言首页只出现一次主场景衔接，栏目切换、更新、精选、作品、工具按顺序出现；普通内容没有重复箭头。
- [ ] **Step 2: 实现首页开放式布局**：保留场景下的一次主内容起点；用细线、半透明层和局部强调替代整页白色圆角卡；侧栏使用图片、色条和分隔线；减少伪统计和重复链接。
- [ ] **Step 3: 调整内容密度**：桌面按三栏稳定网格，移动按单列；项目封面使用真实 cover，没有 cover 时不生成廉价占位卡。
- [ ] **Step 4: 运行截图审查**：1440、1280、1024、390px 截图检查 banner、波浪、正文间距、侧栏和无横向溢出。
- [ ] **Step 5: 提交**：`refactor(public): 优化首页内容层次`。

### Task 5: 全站交互、可访问性与回归

**Files:**
- Modify: `src/lib/components/public/PublicLayout.svelte`
- Modify: `src/lib/components/public/SceneBanner.svelte`
- Modify: `src/lib/components/public/*.svelte`（仅受测试发现影响的组件）
- Test: `tests/unit/public-interactions.test.ts`

**Interfaces:**
- 统一使用 `data-motion` 与 `prefers-reduced-motion`，动画规则由 tokens 与场景组件共同控制。

- [ ] **Step 1: 写失败测试**：测试设置面板 click-outside/Escape/hover leave、更多菜单收回、焦点可见、减少动效关闭所有动画。
- [ ] **Step 2: 实现交互细节**：动画只保留低频波浪与颜色/边界变化，移除缩放和位移入场；避免面板关闭抢走键盘焦点；外链动作单独保留图标。
- [ ] **Step 3: 运行完整验证**：`pnpm check`、`pnpm lint`、`pnpm test:unit`、`pnpm build`，并用 Playwright 检查所有公开路由的 HTTP、console error、场景尺寸与横向溢出。
- [ ] **Step 4: 提交**：`chore(public): 完成公开站回归验证`。

### Task 6: 保留数据的本地部署验收

**Files:**
- Modify: none unless validation finds a defect
- Test: `scripts/verify-retained.mjs`, `ops/site.sh`

- [ ] **Step 1: 运行保留输出检查**：`node scripts/verify-retained.mjs --tests --build`，保留输出目录，不清理数据库、媒体、备份或旧镜像。
- [ ] **Step 2: 构建并部署**：使用 `sh ops/site.sh deploy`，确认 `personal-site-web` 与 `personal-site-db` healthy、端口为 `127.0.0.1:5181`。
- [ ] **Step 3: 浏览器验收**：逐页检查首页、文章、笔记、动态、作品、工具、资源、标签、系列、搜索、详情、关于和隐私；验证浅色、深色、移动端和场景开关。
- [ ] **Step 4: 提交最终变更**：检查 `git diff`, `git diff --cached`, 未跟踪文件和 `git status`，提交最终整合变更；不推送远程。
