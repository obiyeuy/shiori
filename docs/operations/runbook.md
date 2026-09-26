# 部署、备份与恢复运行手册

本仓库尚未部署到服务器。生产模板独立于 `personal-site-p0-local`；不接管、重启或修改既有容器。域名/TLS/Cloudflare、服务器可用空间与端口尚未核验，须部署前通过只读方式检查。固定基础镜像摘要来自已验证的 P0；`SITE_IMAGE` 必须填写审阅后的 `仓库@sha256:摘要`，不可使用 latest。

## 生产准备

使用 `ops/compose/production.compose.yaml`，项目名 personal-site-production，独立网络和数据库卷，Web 默认仅绑定 127.0.0.1:5180。数据库不发布主机端口。模板不包含 Docker socket、SSH key 或 root Web；Web 只读挂载状态目录。镜像构建、迁移、启动、DNS 和 TLS 切换均由部署操作者另行执行，本轮未执行。

准备独立 0700 媒体目录，属主匹配 UID 1000；状态文件由备份专用账号创建，以组读权限 0750/0640 挂载给 Web。Web 账号不能写备份和回执。模板关闭 Docker 自动日志轮转以遵守禁止自动删除规则；生产应接入限速/容量受控的外部日志接收，未配置前须保留受控前台日志证据。不要使用清理容器、卷、目录或带删除语义的同步步骤。

先对全新目标执行受控迁移，再启动 Web；排期为独立 jobs profile，恢复验证时始终不启动。迁移从 0000 到 0003 按校验和执行。现有本机容器未重建，直接访问旧容器可能仍是早期版本；新版本本地验证由独立端口进程完成。

## 密钥与备份

备份 CLI 使用 Node 标准 AES-256-GCM 加密每个文件，每文件随机 nonce；Ed25519 签名清单。`BACKUP_ENCRYPTION_KEY_FILE` 是 32 字节随机密钥文件；`BACKUP_SIGNING_KEY_FILE` 是 Ed25519 私钥 PEM；`BACKUP_VERIFY_KEY_FILE` 是对应公钥 PEM。私钥/加密密钥权限必须 0600，位于工作区及备份目录之外，独立加密保存副本。仅在备份专用账号环境设置路径，不能传给 Web，不能把密钥正文写进日志或命令行。

配置 `DATABASE_URL`、`MEDIA_ROOT`、`BACKUP_ROOT`、`BACKUP_STATUS_ROOT`、`BACKUP_KEY_ID` 后运行 `sh ops/backup/server-backup.sh`。每次创建 UUID 目录，所有写入为独占新文件。失败集保留，不写 complete 标记。只有文件加密、校验、签名通过后写 complete 与成功记录。

数据库转储采用本应用的版本化逻辑格式：在同一 REPEATABLE READ 事务中导出所有当前 schema 业务表、不可变迁移 SQL、媒体清单与 pg_export_snapshot 标识。它不是 pg_dump，也不覆盖 PostgreSQL 全局角色、扩展或其他 schema；恢复工具按迁移重建表和约束，再以类型化 JSON 导入，未知表直接拒绝而不忽略。可选 pg_trgm 索引需恢复后单独启用。数据库账号、SESSION_SECRET、OAuth 密钥等运行环境通过独立密码管理器恢复；keyId 仅为密钥引用。内存中构造逻辑转储及单文件加密，当前适合个人站规模，数 GiB 数据前必须增加流式备份实现并重新演练。

media_variants 中所有文件纳入，包括未引用、历史及原图；快照后上传属于下一集。存储文件不可变，不自动清理。当前磁盘空间不足时不运行真实大体量备份；测试使用隔离小语料。

## Mac 拉取与回执

配置专用只读 SSH 别名 `BACKUP_READ_HOST`，固定 `BACKUP_REMOTE_ROOT`，本地 `BACKUP_ROOT`、待拉取 `BACKUP_SET_ID`，以及受限接收账户 `BACKUP_RECEIPT_HOST`。执行 `sh ops/backup/mac-pull.sh`：只读 cat 传输，验证签名/密文校验/GCM，再生成 pending-receipts 文件，最后通过 SSH stdin 发送。没有 rsync --delete 或目录清理。现存文件与远端不同立即失败并保留，须人工核对；不覆盖已存在的不同产物。

接收账户必须配置 forced command 为 `ops/backup/receipt-command.sh`，禁用 PTY、转发、通用 shell，不解释 SSH_ORIGINAL_COMMAND；读账户与回执账户分别最小授权。接收只认已有完整集 ID、清单摘要、数量和字节数。重复成功幂等，最新恢复点按服务器签名的 snapshotAt 排序，不按 Mac 自报时间。回执提交失败时保留本地 pending 文件，重新发送同一文件即可；服务端成功只说明受信 Mac 报告已验证，不证明远端磁盘永久可靠。

## 评论导出与容量

`node node_modules/tsx/dist/cli.mjs scripts/backup.ts giscus` 使用 `GISCUS_REPOSITORY` 与 0600 `GISCUS_TOKEN_FILE`，按 GraphQL 分页导出 Discussions、评论及回复，任何限流/分页失败不记成功，独立写 giscus-export 状态。令牌仅 CLI 使用，没有创建 OAuth 应用。当前未配置真实令牌，网络行为仅模拟验证。

`node node_modules/tsx/dist/cli.mjs scripts/collect-storage.ts` 采集 MEDIA_ROOT、BACKUP_ROOT、DATABASE_STORAGE_PATH，按设备号去重，每分钟调度由部署操作者配置。每日服务器备份/评论导出、Mac 拉取同样由部署操作者配置。未安装系统定时任务。

## 隔离恢复

设置本机 `DATABASE_URL`（需有创建独立数据库的权限）、`RESTORE_ROOT` 及备份密钥路径，执行 `node node_modules/tsx/dist/cli.mjs scripts/backup.ts restore <备份集UUID>`。只接受 loopback 数据库，创建随机 restore_ 数据库与全新目录；绝不覆盖原数据库，不删除旧文件。校验失败则不导入。

恢复后所有会话撤销、OAuth attempt 消耗、未完成排期取消、Giscus 禁用；不启动任何 worker/备份服务。恢复报告记录快照点、目标数据库、媒体目录、实际耗时及成功/失败。人工核对内容、媒体、版本、权限，再决定正式切换，不能把“能读取 JSON”当作完成恢复。失败数据库和文件保留供排查。

## 尚需真实环境验证

服务器硬件/容量、独立端口、域名/TLS/Cloudflare、SSH 权限、Mac 回执实际链路、真实 Giscus API 权限、代表性数据规模与性能尚未验证。这些是上线门禁，不因本机测试通过而自动通过。
