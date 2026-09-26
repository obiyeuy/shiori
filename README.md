# 个人综合站

从 [文档导航](docs/README.md) 阅读已批准设计和实施计划。P0 工程基础已完成本地验收；P1 增加内容编辑与发布链；公开站和完整工作台属于后续阶段，当前首页/工作台只是基础占位。

使用 Node 24.19.0、pnpm 11.19.0。依赖版本和操作边界见 [工具链](docs/engineering/toolchain.md)，测试证据见 [P0 验证报告](docs/verification/P0.md)。

## 本地运行

1. 将 `.env.example` 复制为 `.env`，替换本地数据库密码和会话密钥；保持 `DATABASE_URL` 中的密码与 `POSTGRES_PASSWORD` 一致。真实密钥不提交到 Git。
2. `pnpm install --frozen-lockfile`。
3. `docker compose --env-file .env up -d db`。只创建 `personal-site-p0-local` 项目的独立数据库，端口仅绑定 `127.0.0.1:55432`。端口冲突时先核对，不修改其他容器。
4. 在 shell 中加载自有 `.env`：`set -a`、`source .env`、`set +a`。这些命令只适用于自己创建的可信配置文件。
5. `pnpm db:migrate`。重复执行会校验迁移摘要；失败即停止，Web 启动不会隐式迁移。不要用旧镜像掩盖迁移失败。
6. 为当前命令临时设置 `OWNER_PASSWORD` 后运行 `pnpm db:init-owner`，完成后从 shell 移除该变量。初始化只能创建唯一站长，没有公网注册/初始化接口。
7. `pnpm dev --host 127.0.0.1`，访问 `/login`。本地 HTTP Cookie 仅在回环开发环境允许不带 Secure；服务器必须 HTTPS。

可选 `pnpm db:search-index` 单独安装 pg_trgm/标题索引；没有扩展权限不影响基础迁移。P2 才实现中文搜索和有界字面回退。

## 验证

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
docker compose --env-file .env build web
```

`pnpm test` 必须提供独立本地 `DATABASE_URL`，真实 PostgreSQL 测试会建立并保留新 schema，不跳过数据库测试、不删除历史测试数据。HTTP 测试使用回环端口 5199。单独运行无需数据库的检查用 `pnpm test:unit`。

本地镜像可通过 web profile 验证；它不是服务器部署。上线还需后续计划和真实 OAuth/Giscus/服务器输入，当前不应对公网暴露。

## 内容生产链

新建/导入入口 `/workspace/import-export`，编辑器可保存版本、预览、导出与发布/排期。运行前显式执行 `pnpm db:migrate` 安装 P1 增量结构。媒体目录及排期 worker 的配置、接口和保护规则见 [内容生产链](docs/engineering/content-pipeline.md)。P2 尚未提供公开详情页面，发布结果的公开地址供后续阶段接入。

浏览器验证需要本机 Chrome（默认 macOS 安装路径，可设置 `CHROME_EXECUTABLE`），端口 5201。测试使用持久 profile 并保留，不自动删除文件或目录。
