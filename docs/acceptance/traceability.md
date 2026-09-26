# 验收追踪矩阵

当前结论：本机自动化核心流程已验证；服务器上线被外部配置、素材/字体及人工辅助技术检查阻断。以下“通过”仅针对明确列出的证据，不代表未执行场景通过。

环境：macOS / Apple M1，Node 24.19.0、PostgreSQL 16.15、本机 Google Chrome；隔离数据库/schema、保留式构建与浏览器 profile。测试集合 31 文件/98 用例；各阶段报告记录实际命令与限制。

## 阶段证据

| 阶段 | 报告 | 提交 |
|---|---|---|
| P0 工程/权限 | [P0](../verification/P0.md) | ca208dd |
| P1 编辑/发布 | [P1](../verification/P1.md) | 3bfcfb6 |
| P2 公开/搜索 | [P2](../verification/P2.md) | 855fe59 |
| P3 工作台 | [P3](../verification/P3.md) | 6c74404 |
| P4 备份/恢复 | [P4](../verification/P4.md) | dbcc698 |

## A1–A9

| ID | 覆盖与证据 | 结论/剩余门禁 |
|---|---|---|
| A1 | [发布竞态](../../tests/integration/publish-races.test.ts)、[排期 worker](../../tests/integration/schedule-worker.test.ts) | 取消/显式保留排期通过 |
| A2 | 同上，撤回与 worker 并发 | 事务隔离通过 |
| A3 | [公开页面](../../tests/integration/public-pages.test.ts)、[仓储](../../tests/integration/content-repository.test.ts) | 历史别名/撤回/稳定身份通过 |
| A4 | [媒体授权](../../tests/integration/media-authorization.test.ts)、发布 preflight | 未授权派生/原图拒绝通过 |
| A5 | 同上、[工作台设置](../../tests/integration/workspace-actions.test.ts) | 展示图授权不公开原图；正式 PDF/视频样本人工核对待做 |
| A6 | [工作台事务](../../tests/integration/workspace-actions.test.ts)、[编辑冲突](../../tests/integration/editor-conflict.test.ts) | 归档/系列/标签/恢复通过 |
| A7 | 工作台事务、[浏览器](../../tests/integration/workspace-browser.test.ts) | 人工状态带时间；没有服务探测请求。真实服务 URL 待配置 |
| A8 | 编辑冲突、[自动保存](../../tests/unit/autosave.test.ts)、[编辑浏览器](../../tests/integration/editor-browser.test.ts) | 导入草稿/会话失效保留文本/冲突覆盖；真实 IME 与整段过期重登导出人工演练待做 |
| A9 | 编辑/工作台/公开浏览器测试、[生产验收脚本](../../scripts/acceptance.ts) | 键盘、320px、200% 字体、焦点返回、排序自动化通过；真实读屏/IME未执行，不能宣称全量无障碍通过 |

## S01–S16

统一入口：[搜索固定语料](../../tests/integration/search-samples.test.ts)、[规范化单测](../../tests/unit/search-samples.test.ts)、[浏览器导航](../../tests/integration/public-browser.test.ts)、[基准](../verification/P2-search-benchmark.md)。

| ID | 场景 | 结论 |
|---|---|---|
| S01 | 中文搜索 A/B 且A优先 | 实库通过 |
| S02 | PostgreSQL pg_trgm 多片段 AND | 实库通过 |
| S03 | 全角/NFKC/大小写 A/B/I | 实库通过 |
| S04 | C++/C# 字面标点 | 实库通过 |
| S05 | Node.js 字面匹配 | 实库通过 |
| S06 | 单字“索” A/B/D | 实库通过 |
| S07 | pg_trgm 字面下划线 | 实库通过 |
| S08 | PostgreSQL 类型资源 | 实库通过 |
| S09 | PostgreSQL 标签数据库 | 实库通过 |
| S10 | 海盐/琥珀/松针私有隔离 | 结果/计数与分发测试覆盖 |
| S11 | 水杉草稿→发布边界 | 实库通过，撤回另由公开指针测试覆盖 |
| S12 | JSON 工具/SvelteKit作品 | 实库通过 |
| S13 | %与特殊符号非通配 | 实库通过 |
| S14 | 空白/100字符/8片段限制 | 单测与实库通过 |
| S15 | 网络失败保留输入并重试 | 实库断连注入/浏览器错误呈现覆盖；真实查询超时注入未独立执行 |
| S16 | 21条分页与后退 | 实库无重复遗漏、浏览器恢复条件通过；滚动位置需进一步人工核对 |

1k/10k 合成语料、无索引/可选索引均测得 p95<500ms；不能等同部署硬件实测。查询有 2s 超时和参数边界。

## O01–O09

| ID | 证据 | 结论/限制 |
|---|---|---|
| O01 | [状态](../../tests/integration/backup-status.test.ts) | 服务器/Mac 状态分离；实际部署未配置 |
| O02 | [备份完整性](../../tests/integration/backup-receipts.test.ts) | 损坏校验拒绝；真实 Mac 链路待做 |
| O03 | [拉取包装](../../ops/backup/mac-pull.sh)、[CLI](../../scripts/backup.ts) | pending 回执保留、发送失败不覆盖；未执行真实 SSH 中断演练 |
| O04 | 备份回执、状态测试 | 幂等/旧集不倒退通过 |
| O05 | [恢复演练](../../tests/integration/recovery-drill.test.ts) | 导出快照后插入被排除通过 |
| O06 | 备份完整性测试 | 密文/标记/迁移不匹配拒绝，不静默成功 |
| O07 | [评论导出](../../tests/unit/giscus-export.test.ts) | 模拟分页/429通过；真实 API 权限待做 |
| O08 | 状态测试、[状态单测](../../tests/unit/operational-status.test.ts) | 快照与采集陈旧判定通过 |
| O09 | 恢复演练 | 全新本机DB/目录恢复公开内容、草稿、媒体、旧会话失效通过；真实服务器/大数据恢复未做 |

## 视觉、性能与既有容器

六断点 320/375/768/1099/1100/1440，浅/深/系统三主题使用生产构建、6更新/3精选/3作品/3工具合成内容；截图与测量路径在 P5 报告。没有正式图片/字体，不将其当作最终素材验收。当前 DOM 语义检查不是 axe 或真实读屏测试。

P4 保留容器ID/镜像/启动时间/端口/挂载、网络和卷的前后快照，cmp一致；只读证据位于 P4 忽略日志目录。P0 发现本机容器为空后创建的两容器保持运行，P1–P5没有重建部署。未访问生产服务器。
