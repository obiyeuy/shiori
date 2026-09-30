# P0 工程工具链与边界

## 固定版本与兼容性

实际工具链：Node 24.19.0（24 LTS，`.nvmrc`）、pnpm 11.19.0（要求 Node ≥22.13）。Docker Node 固定摘要实测为 24.21.0，同属 24 LTS；本机与镜像分别验证。所有直接依赖为精确版本，完整传递依赖在 `pnpm-lock.yaml`。以 `pnpm install --frozen-lockfile` 安装；`pnpm-workspace.yaml` 只允许 esbuild 的已知构建脚本。

| 组件 | 版本来源 / 许可证 | 核验结论 |
|---|---|---|
| SvelteKit / Svelte / adapter-node / Vite | package.json；MIT | 当前固定版本完成 typecheck、构建与真实 HTTP 测试 |
| PostgreSQL | 16-bookworm 固定 manifest digest（实测 16.15）；PostgreSQL License | 独立本地 Docker，真实约束、事务、迁移测试 |
| pg | package.json；MIT | 单一生产连接池驱动，参数化 SQL，连接超时 5 秒，最多 5 连接 |
| Drizzle ORM / Kit | package.json；Apache-2.0 / MIT | ORM 已升级至修复 SQL 标识符漏洞的 0.45.3；生产不使用 Kit push |
| @node-rs/argon2 | package.json；MIT | Argon2id、19 MiB/2 轮/1 lane；本机与 Linux 镜像均安装验证 |
| oauth4webapi | 3.8.8；MIT | npm 未标记 deprecated；OAuth 协议处理、PKCE、state、超时与固定 GitHub endpoint |
| Vitest | 4.1.11；MIT | 升级到修复已知中危漏洞版本；真实数据库测试不依赖 pg-mem |

Arctic 候选版本已被 npm 标记停止支持，未采用；改用 oauth4webapi。历史试装留下的 pg-mem/postgres 包不参与生产路径，后续整理依赖时不得执行违反用户删除限制的清理。

审计剩余：SvelteKit 传递 cookie 0.6.0 的低危路径/名称校验问题（Cookie 名限制 ASCII、路径代码常量）；Drizzle Kit 开发工具 esbuild 0.18.20 的开发服务器中危问题（不启动其开发服务器，不对外暴露）。无高危/严重项。每次升级重新审计，不把“当前无高危”当永久保证。

## 数据库与迁移契约

SQL 是结构权威，Drizzle 表定义是代码映射；SQL 中的延迟复合 FK、永久 alias 归属、版本不可变触发器不能用自动 push 覆盖。生产环境禁止使用 `drizzle-kit push` 替代受控 SQL migration；修改表结构时必须同时检查 SQL、Drizzle 映射和迁移验证。公开指针必须引用本内容版本；`(type,slug)` 永久保留命名空间。归档不改变公开指针；撤回查询结果为空。首次发布时间及首次发布后类型不可改。draft CAS 先锁内容实体，覆盖首次并发保存；未结束排期含 pending/running/retrying/failed，至多一条。

`pnpm db:migrate` 在事务和 advisory lock 下执行迁移并记录 SHA-256；重复执行不重复 DDL，摘要不符拒绝。失败回滚并停止，不做破坏性 down。演练/测试建立新数据库或 schema，保留原记录，不删除目录、文件或测试数据库。`pnpm db:search-index` 是显式可选迁移，基础迁移不要求扩展权限。

P0 `ContentRepository.publish` 仅验证数据契约的内部基础操作，没有 HTTP 发布入口。P1 必须加入共享渲染/media preflight、确认修订、幂等发布事件、撤回/排期策略后才能开放内容发布；不能把该基础方法直接绑定路由。

## 认证和请求保护

密码仅 Argon2id 摘要；会话 256 bit 随机 token，数据库存 SHA-256，7 日最长/24 小时闲置，到期边界失效。Cookie HttpOnly、SameSite=Lax；HTTPS 带 Secure，本地回环 HTTP 仅供开发。不信任任意客户端转发 IP 头；服务器反代由后续 P4 单独配置可信来源。

后台、预览、私有媒体路径在 hooks 服务端校验；所有认证/后台写请求比较 Origin 与配置 origin，不能比较两个都由请求者提供的头。登录按固定 owner 桶和来源摘要桶限速；错误不泄露账号是否存在。最近 10 分钟重新认证是敏感变更前置，敏感事务重查数据库状态，修改密码/身份撤销其他会话并审计。

OAuth 使用一次性 DB state、浏览器绑定 Cookie、PKCE、GitHub 数字 ID 显式绑定。回调不初始化账号，不按邮箱/用户名合并，10 分钟到期；不保存外部 access token。网络故障显示失败并重新开始，不记录密钥。未配置则返回 503。真实 GitHub 应用/回调仍是用户后续上线输入，本轮只做协议响应替身与本地路由检查。

## 文件与阶段边界

根 Compose 是本地测试，固定项目名/卷/网络和回环端口；P4 才编写服务器 Compose。初始化/迁移不在 Web 启动路径；运行镜像使用非 root 用户，不挂载 Docker socket。

P0 补充 `src/lib/server/operations/status.ts` 给 P3/P4 消费；默认未配置，不编造成功；状态保留事件时间、采集时间、最后成功/失败，26 小时备份提醒、2 小时运行待确认。P4 负责真实状态读取。P0 增加最小 workspace 页面只为验证登录回跳，P3 接管其 UI。

`README.md` 的工程入口和 `.env.example` 的基础变量由 P0 建立；P5 后续追加验收和上线说明。测试/构建产物、凭据和本地数据库设置均忽略，不进入提交。
