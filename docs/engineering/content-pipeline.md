# P1 内容生产链接口与运行边界

本阶段增加编辑器和生产链；公开详情、搜索、RSS 页面由 P2 消费 `public_content`，工作台列表和共享布局由 P3 实现。新建/导入入口为 `/workspace/import-export`，编辑入口为 `/workspace/content/<UUID>/edit`。账号沿用 P0 唯一站长，所有工作台写请求检查同源 Origin。

## 服务接口

导入/导出当前是 Markdown 正文交换契约：导入读取首个 H1 作为标题并保留正文，导出返回正文 Markdown；slug、类型、标签、封面、描述和评论设置等元数据不保证往返。需要可重新发布的完整内容包时，必须先定义并验证版本化 frontmatter 格式，不得把当前正文导出误用为完整备份。

| 服务 | 契约 |
|---|---|
| `renderMarkdown(source, mode)` | UTF-8 正文 ≤1 MiB；返回清理 HTML、可读文本、目录、媒体引用和未解析引用；preview/public 仅媒体 URL 权限面不同 |
| `MediaService.stageUpload({name,bytes})` | magic bytes 白名单，随机键写入 MEDIA_ROOT，返回 pending；原文件永不覆盖 |
| `MediaService.process(key)` | PostgreSQL advisory lock 串行处理；ready/failed 持久化；失败可重试，保留原文件和已生成文件 |
| `MediaService.authorizeMedia(owner,key,variant)` | variant 为 display/original；匿名只读取已有 public_at 授权的文件；不可用则报错 |
| `Autosave.change/flush/rebase` | 单个请求在途，2 秒空闲、15 秒输入上限；CAS 冲突保留本地；手动核对服务器后 rebase |
| `EditorService.snapshot/restoreVersion` | 快照不可变；restore 需预期修订，仅生成新编辑稿，不改公开或排期 |
| `PublicationService.runPreflight` | 锁定内容读取确认修订，校验字段/slug/标签/媒体可读性；不请求外部资源 |
| `publishNow(id, options)` | options 含随机 UUID key、revision、expectedScheduleRevision、important、keepSchedule；同 key 同参数返回原结果，不同参数拒绝 |
| `createSchedule` | 另含带时区 Date runAt，必须晚于服务端当前时刻；固定快照；排期确认号在同一内容历代任务间不重复 |
| `updateSchedule` | 需排期 id/revision，cancel/retry/time/version 为显式操作；拒绝已结束任务 |
| `withdrawPublication` | 内容锁下移除公开指针/检索投影并取消全部未结束排期，保留历史及已公开媒体 |
| `scanDueSchedules` | 最多取 100 个到期任务，内容锁→任务锁，事务提交发布事件/投影/授权/结果，自动补发有效任务 |

公开查询必须同时遵守 `content_items.public_version_id`；严禁查询草稿作为公开回退。`versions.published_at` 是 P0 历史字段，P1 非公开快照也需写它，不应用于计划发布时间或实际公开时间；实际公开时间读 `public_content.published_at` / `publication_events.created_at`，首次公开读 content_items。RSS ID 固定为 `urn:uuid:<content UUID>`。历史 alias 只解析当前公开指针。

`media_references` 保留每次修订和版本记录；当前稿引用用 content_id + drafts.revision 匹配，历史记录不自动清理。文件 ready 与 public_at 是不同维度；发布授权与公开指针同事务。已公开媒体撤回后仍可公开读取，界面明确提示。

## 媒体存储

- `MEDIA_ROOT` 是进程可访问的受保护持久目录，不能放在 `static`；目录应由应用运行用户拥有，权限 0700，新文件 0600。新目录按该权限创建；已有权限不合适则停止，不擅自修改宿主目录。
- Compose 用 `MEDIA_ROOT_PATH` 指定宿主 bind mount，容器内 `/data/media`。部署前由服务器管理员准备目录及 UID/GID，不能直接依靠 Docker 建立 root 所有的空目录。本轮不启动或替换任何已有容器。
- PNG/JPEG/WebP/GIF/AVIF ≤20 MiB，总解码像素 ≤40MP；PDF ≤50 MiB；MP4/WebM ≤100 MiB。sharp/libvips 版本逐项保存在媒体 processor 字段。静态图去 EXIF、旋转并生成最大 1920px WebP；原图保留。动画不静默变静态，需作者明确选择原文件下载。
- `media:<UUID>` 指向展示图；`media:<UUID>/original` 表示明确公开原文件下载；有意义图片需 alt，装饰图写 `![](media:<UUID> "decorative")`。外部图片转来源链接，不远程下载。
- `statfs` 采集容量和 collectedAt，<15% 警告、<10% 或未知停止新增/处理。现有读取不依赖此阈值。记录按实际动作采样；P4 增加周期采集，不能将旧数据冒充最新容量。
- 私有路由 no-store；公开路由授权后 immutable；文件名经编码，下载 nosniff + sandbox。视频支持单段 byte range，无自动播放或转码。
- 上传默认 Node adapter 请求体上限过小，Compose 明确 `BODY_SIZE_LIMIT=110M`；上传端点仍独立限制文件 100 MiB。

## 排期 worker

加载可信环境文件后运行 `pnpm worker:schedules`；每轮结束后约 30 秒再扫描，`pnpm worker:schedules --once` 仅运行一轮。不要在每次 HTTP 请求触发排期。SIGTERM 等待在途事务后关闭；断连自动释放数据库锁，未提交操作回滚，重启重试仍有效任务。

首次瞬时失败后分别等待 1/5/15 分钟，最多三次自动重试（总计四次尝试）。校验错误立即 failed，失败任务仍占该内容未结束排期位置。手动 retry 明确重启有限尝试周期并审计。处理期间没有已提交的永久 running 标记；worker 崩溃不留下无限期占用。

`compose.yaml` 的 pipeline profile 提供独立 worker 配置；默认不启用。本轮仅编辑配置，不运行 Compose up 改变原有服务。服务器部署/监控/备份由 P4 与用户后续部署流程处理。

## 验证约束

`pnpm test` 使用实际 PostgreSQL，新 schema 永久保留。浏览器测试使用安装的 Chrome（可通过 `CHROME_EXECUTABLE` 指定绝对路径）和端口 5201，P0 HTTP 测试用 5199。浏览器 profile、截图、上传测试文件保留；不执行清理目录。

本机磁盘曾测得可用 9.9%，故生产保护正确拒绝新媒体。媒体成功路径测试只替换 statfs 容量采样，仍用实际 sharp、文件系统和数据库；不能把它解释为服务器资源验收通过。P5 仍需实际 IME、读屏和完整站点验收，P4 需恢复演练。
