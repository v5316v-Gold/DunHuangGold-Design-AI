# 敦煌金 AI Architecture V2

## 五层边界

1. **前端入口层**：Sidebar/WorkspacePanel 负责展示与交互；公开功能目录来自 `/api/features`，组件映射保留静态 dynamic import 以满足 bundler 可分析性。
2. **API 管理层**：所有生成请求进入 `/api/ai/generate`，统一 `{ success, data, error, meta }`；JWT 在路由入口校验，管理员路由额外校验 role。
3. **功能编排层**：`FeatureOrchestrator` 从数据库读取启用状态、成本与执行器链，按 default + fallback 执行，屏蔽 provider 细节。
4. **数据与资产层**：Drizzle/PostgreSQL 管理 features、works.feature_code、audit_logs；StorageService 提供本地/S3/R2 统一接口；迁移位于 `src/db/migrations/007_architecture_v2.sql`。
5. **执行与运维层**：Mock/ComfyUI/Third-party executor 可独立测试；BullMQ Worker 消费 `generation:v2`；Compose 拆分 app/worker/db/redis。

## 运行约定

- 生产环境设置 `API_KEY_ENCRYPTION_KEY`（64 位 hex）后使用 AES-256-GCM 加密 API Key。
- 首次部署执行 007 migration，并将 17 项静态定义 seed 至 `features` 表；DB 不可用时公开目录和编排器安全回退到静态定义/Mock。
- Worker 镜像需要在构建阶段编译 `workers/orchestrator-worker.ts` 到 `workers/dist`，当前 Compose 命令是部署契约。

## 可测试性

- `MockExecutor` 覆盖所有 FEATURE_LIST ID，适合本地与单元测试。
- `StorageService` 可通过 LocalStorageService 在无云凭据环境测试。
- API 层可使用 JWT + `x-request-id` 验证统一响应和链路 trace。
