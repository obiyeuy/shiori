# 公开查询与搜索契约

公开读取必须同时匹配 `content_items.public_version_id` 与 `public_content.version_id`。仅存在投影行不授予公开权限；撤回后历史别名也返回 404。公开 HTML、搜索、RSS 和 sitemap 使用 no-store，避免撤回后继续分发陈旧缓存。

搜索以 NFKC、小写、空白合并处理输入，超过 100 Unicode 字符或 8 片段拒绝。片段 AND；类型/标签各组内 OR，组间 AND。SQL 使用参数化的转义 LIKE 候选和 strpos 精确字面判定，保留 `%`、`_`、C++ 等含义。排名为标题、当前标签名称、摘要、正文、完整短语标题、首次发布时间、UUID；20 条分页，2 秒事务查询超时。失败返回 total=null 与可重试错误，不冒充零结果。

0002_public_search 为公开投影增加三个 STORED 规范化字段，不改写已应用迁移。可选 `pnpm db:search-index` 在这些字段建立 pg_trgm GIN 索引；扩展不可用仍使用同一字面查询。标签使用当前名称，重命名即时生效。新索引与 P0 的旧 versions 索引名称独立，不删除旧对象。

首页 `featured-content` 设置为内容 UUID 数组，保留数组顺序，仅文章/笔记可入选，最多 3 条。公开系列导航按人工 position 排序，普通同类导航按首次发布时间；相同目标不重复显示。相关内容按公开标签交集选择最多 3 条。

Giscus 设置位于 site_settings.giscus，仅传递 enabled/repo/repoId/categoryId 白名单字段；点击后才连接第三方。按内容 ID 与配置重建评论实例，防止路由复用导致串文。未配置时不伪造 Discussion 链接。

## 保留产物验证

本仓库执行环境禁止删除目录和批量删除文件。SvelteKit/Vite/Node adapter 默认清理会触发删除，因此本轮检查使用：

```sh
node scripts/verify-retained.mjs --tests --build
```

脚本在 `.local/verification/<时间>-<随机标识>/` 创建独立 kit、应用输出、缓存和临时目录；预加载 retain-generated.cjs 保留清理目标，遇到运行目录以外的删除则拒绝。每个浏览器测试服务器使用独立子目录，所有文件及测试数据库 schema 保留，不自动清理。此预加载器仅用于本地验证，不进入产品请求链。常规 package scripts 和 Docker 产物位置暂不改变；在当前删除约束下不要直接执行普通 build/typecheck。可追加测试文件路径限制验证范围。
