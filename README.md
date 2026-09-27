# 个人综合站

从 [文档导航](docs/README.md) 阅读已批准设计和实施计划。P0–P4 已分别完成本地验证与提交。完整验收入口见 [追踪矩阵](docs/acceptance/traceability.md) 和 [上线门禁](docs/operations/deployment-checklist.md)；真实服务器、第三方配置及人工验收尚未完成，不部署。

使用 Node 24.19.0、pnpm 11.19.0。依赖版本和操作边界见 [工具链](docs/engineering/toolchain.md)，测试证据见 [P0 验证报告](docs/verification/P0.md)。

## 本地运行

1. 将 `.env.example` 复制为 `.env`，替换本地数据库密码和会话密钥；保持 `DATABASE_URL` 中的密码与 `POSTGRES_PASSWORD` 一致。真实密钥不提交到 Git。
2. `pnpm install --frozen-lockfile`。
3. `docker compose --env-file .env up -d db`。只创建 `personal-site` 项目的独立数据库，端口仅绑定 `127.0.0.1:55432`。端口冲突时先核对，不修改其他容器。
4. 在 shell 中加载自有 `.env`：`set -a`、`source .env`、`set +a`。这些命令只适用于自己创建的可信配置文件。
5. `pnpm db:migrate`。重复执行会校验迁移摘要；失败即停止，Web 启动不会隐式迁移。不要用旧镜像掩盖迁移失败。
6. 为当前命令临时设置 `OWNER_PASSWORD` 后运行 `pnpm db:init-owner`，完成后从 shell 移除该变量。初始化只能创建唯一站长，没有公网注册/初始化接口。
7. `pnpm dev --host 127.0.0.1`，访问 `/login`。本地 HTTP Cookie 仅在回环开发环境允许不带 Secure；服务器必须 HTTPS。

可选 `pnpm db:search-index` 单独安装 pg_trgm/标题索引；没有扩展权限不影响基础迁移。公开搜索支持中文与有界字面回退。

## 验证

```sh
node scripts/verify-retained.mjs --tests --build
pnpm lint
# Optional production browser matrix, retains all output:
node scripts/verify-retained.mjs --acceptance
```

`pnpm test` 必须提供独立本地 `DATABASE_URL`，真实 PostgreSQL 测试会建立并保留新 schema，不跳过数据库测试、不删除历史测试数据。HTTP 测试使用回环端口 5199。单独运行无需数据库的检查用 `pnpm test:unit`。

本地镜像可通过 web profile 验证；它不是服务器部署。上线还需后续计划和真实 OAuth/Giscus/服务器输入，当前不应对公网暴露。

## 内容生产链

新建/导入入口 `/workspace/import-export`，编辑器可保存版本、预览、导出与发布/排期。运行前显式执行 `pnpm db:migrate` 安装 P1 增量结构。媒体目录及排期 worker 的配置、接口和保护规则见 [内容生产链](docs/engineering/content-pipeline.md)。公开详情、搜索、RSS 与工作台现已接入；备份与部署说明见 [运行手册](docs/operations/runbook.md)。

浏览器验证需要本机 Chrome（默认 macOS 安装路径，可设置 `CHROME_EXECUTABLE`），端口 5201。测试使用持久 profile 并保留，不自动删除文件或目录。

## 单实例容器入口

本机统一使用 `sh ops/site.sh status` 查看，`sh ops/site.sh logs` 查看日志，`sh ops/site.sh deploy` 构建并更新。默认读取不入库的 `.local/site.env`，其他环境用 `SITE_ENV_FILE=/绝对路径/配置文件` 指定。部署成功后尝试移除前一个应用镜像；仍被引用时保留并提示，不强制删除。

项目名固定为 `personal-site`，容器名为 `personal-site-web`、`personal-site-db`，可选排期服务为 `personal-site-scheduler`；应用共用 `personal-site:latest`。不要另设 `-p` 或再创建 preview 项目。每个 Docker 主机只运行一套；本地与生产模板是二选一，不可同时启动。

本机当前沿用原预览数据库卷与媒体目录，地址为 http://localhost:5181。`DB_VOLUME_NAME` 指向已有卷，改名项目不迁移或删除数据库。旧数据库卷保留用于恢复，容器/应用镜像清理授权不包含数据卷、媒体和备份。部署不是数据库迁移，升级 schema 仍须先显式执行受控迁移。
