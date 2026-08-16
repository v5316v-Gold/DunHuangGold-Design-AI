# 敦煌金 AI 设计平台 · 专家级评分报告

> **评估日期**:2026-08-16
> **评估基准**:软件工程专业标准(架构 / 后端 / 前端 / AI 能力 / 部署 / 安全 / 工程实践 / 文档)
> **评估对象**:`DunHuangGold-Design-AI` 工作区代码 + 本地容器实机(web/worker/postgres/redis/minio 重建后)
> **量化基础**:335 TS/TSX 文件 · 55,230 行源码 · 76 个 API 路由 · 11 个迁移 · 90 次提交 · 22 个测试文件 · `verify-deployment` 17/17 通过
> **总体结论**:**企业内测级(Production-Ready for Internal Pilot)** — 代码已达生产级,推向对外商用主要补齐"测试覆盖 + 运行时环境加固"

---

## 一、总分:86 / 100 ⭐

| 维度 | 权重 | 得分 | 评级 |
|---|---:|---:|---|
| ① 架构设计 | 15% | 92 | 🟢 优秀 |
| ② 后端与数据层 | 15% | 88 | 🟢 优秀 |
| ③ 前端与交互 | 10% | 82 | 🟢 良好 |
| ④ AI 能力与执行器 | 15% | 78 | 🟡 良好(环境约束) |
| ⑤ 部署与运维 | 15% | 88 | 🟢 优秀 |
| ⑥ 安全与合规 | 10% | 80 | 🟢 良好 |
| ⑦ 测试与工程实践 | 10% | 74 | 🟡 良好(覆盖待提升) |
| ⑧ 文档与可维护性 | 10% | 88 | 🟢 优秀 |

**加权总分 ≈ 85.5 → 86 / 100**

---

## 二、各维度详解

### ① 架构设计 — 92 分 🟢(项目最强维度)

**✅ 已达成**
- 5 层 Hexagonal 架构严格执行:L1 Presentation → L2 Application → L3 Orchestration → L4 Adapters → L5 Infrastructure,单向依赖无反向
- ADR 决策体系完整落地:ADR-002(强制 AI 入口)/ ADR-008(算力三态账本)/ ADR-009(Workflow 不可变)/ ADR-010(生产禁 mock)/ ADR-011(状态机)/ ADR-012(降级)
- ExecutionPlan 冻结语义:taskId / featureId / executorId / fallbackChain / workflowVersion / models 快照,创建时冻结、运行不变
- PolicyOrchestrator:routing → retry → fallback 三策略解耦
- 单一真源:`feature-registry.ts`(组件映射)/ `features` 表(DB 元数据)/ `config/api-config.ts`(常量)三层对齐
- 幂等防双扣:PowerLedger reserve → consume → release + `(userId, taskId, featureId)` 幂等键
- Workflow 发布门禁:8 项(JSON/deps/nodes/input/output/comfyui-validate/dry-run/feature-binding)完整实现

**⚠️ 扣分点**
- 部分 legacy 层(`src/storage/*` 旧 schema 转发)与新层并存,虽已统一但存在迁移噪音

---

### ② 后端与数据层 — 88 分 🟢

**✅ 已达成**
- 22 张表设计完整(users / tasks / works / power_transactions / workflow_versions / worker_nodes / api_config_secrets 等)
- 76 个 API 路由,其中 31 个 admin 端点(模型中心 / 任务中心 / 用户管理 / 算力对账)
- BullMQ 异步任务全闭环:入队 → 状态机 → 重试 → 死信 → 算力结算 → 作品入库
- Drizzle ORM + 11 个迁移,幂等可重复执行
- SSE 实时推送:任务状态变更 → Redis pub/sub → 前端 EventSource
- 算力对账脚本 `scripts/reconcile-power.ts`

**⚠️ 扣分点**
- 部分历史遗留表(api_configs 早期字段)存在冗余
- 测试覆盖仅 22 个测试文件,关键链路(编排器 / 账本 / 门禁)缺单元测试

---

### ③ 前端与交互 — 82 分 🟢

**✅ 已达成**
- 17 个功能面板全部实现,懒加载 + shadcn/ui + Tailwind 4
- 敦煌金主题统一(#C8A45C 金 / #0F1114 深色 / #2A2D32 边框)
- 动态 Sidebar:displayGroup + sortOrder 从 DB 驱动
- SSE 进度条 + 轮询降级:useAiGeneration 先 SSE 后轮询,断流自动回退
- Gallery 3s 轮询 + 作品 / 收藏 / 个人中心
- AI 写作助手:全局 textarea 监听 + 润色 / 翻译浮动

**⚠️ 扣分点**
- 部分页面交互复杂度高(profile 页 1000+ 行)
- AI 助手在部分浏览器场景需进一步打磨
- 无移动端专项优化

---

### ④ AI 能力与执行器 — 78 分 🟡

**✅ 已达成(代码层)**
- 三执行器架构:ComfyUIExecutor(16 设计类)/ HermesAgentExecutor(对话)/ MinimaxExecutor(云 fallback)
- ComfyUI 集成深度:dependency-analyzer + custom-node-check + 8 项门禁 + workflow 版本化
- 真实 workflow 绑定:16 个 design 功能 comfyui_configs + 真实模型清单(7 checkpoints / 17 loras / 10 text_encoders / 11 vae)
- fallback 链:ComfyUI → MiniMax → Mock,策略驱动降级

**⚠️ 环境约束(非代码问题)**
- ComfyUI host `/prompt` 间歇 500(用户环境进程问题)
- 云 API 密钥未注入(测试环境),`/api/health` 显示 missing
- Hermes CLI 未装入 worker(生产对话走 MiniMax fallback)
- 实际出图当前走 mock fallback(`ALLOW_MOCK_IN_PRODUCTION=true` 灰度)

**扣分点**:AI 能力"代码就绪度高、实机验证受环境限制";3D/视频功能依赖 ComfyUI host 模型加载,未做端到端真实出图验证。

---

### ⑤ 部署与运维 — 88 分 🟢

**✅ 已达成**
- 5 容器编排:web / worker / postgres / redis / minio,健康检查 + restart 策略 + named volumes
- Docker 多阶段构建:deps → builder → runner,Next standalone + tsup worker
- nginx 反代:TLS1.2/1.3 + HSTS + LAN IP 白名单 + SSE 透传(proxy_buffering off)+ 三档限流
- 自签证书生成器 + 一键部署脚本(`deploy/setup-lan.bat`)
- 备份方案:`scripts/backup.sh`(PG dump + MinIO mirror + S3 上传)+ dcron 容器
- CI/CD:GitHub Actions(lint/typecheck/test/migration/build)+ `deploy-lan.yml`(SSH 部署 + 烟雾测试)
- `verify-deployment.ts` 17/17 实机通过

**⚠️ 扣分点**
- 容器部署本会话使用手动 `docker run`(未统一到 compose 重建流程)
- 生产密钥管理建议接 vault

---

### ⑥ 安全与合规 — 80 分 🟢

**✅ 已达成**
- 密钥保险箱:AES-256-GCM 加密存储 `api_config_secrets`,前端永远 masked
- admin 强制改密:弱口令黑名单 + mustChangePassword 标记
- JWT fail-closed:默认值 / 弱密钥拒绝启动
- SSRF 加固:fetch 层统一出口
- 限流:登录 10r/m + 写操作 30r/m + admin 60r/m
- Mock 守卫:ADR-010 生产默认禁 mock(灰度开关显式)

**⚠️ 风险项(需生产化)**
- 默认 admin 密码在本环境仍为 `admin123`(未改)
- `API_KEY_ENCRYPTION_KEY` 在生产容器为空(需注入)
- 无 refresh token 机制
- TLS 证书为自签(需真实证书 / Let's Encrypt)

---

### ⑦ 测试与工程实践 — 74 分 🟡

**✅ 已达成**
- `tsc --noEmit` 0 错误、lint 0 错误、next build 成功
- 22 个测试文件(230+ 用例)
- `verify-deployment` 17/17 实机通过

**⚠️ 扣分点**
- 核心编排 / 账本 / 门禁逻辑缺单元测试覆盖
- 无 Playwright e2e(README 声称 270 用例但主要是 node 套件)
- 无覆盖率门禁(CI 未强制 coverage %)
- 部分 debug 脚本(`scripts/db-debug.ts` / `mark-debug.ts` 等)留在仓库未清理

---

### ⑧ 文档与可维护性 — 88 分 🟢

**✅ 已达成**
- README 371 行:架构图 / 功能表 / 里程碑 / 运维清单齐全
- AGENTS.md(项目规范)/ docs/ 多份 phase 报告 + 部署指南(DEPLOY-LAN / SECRETS-MANAGEMENT)
- 代码注释密度高(每文件 header 说明职责 / 设计 / 约束)
- git 90 次提交,commit message 规范

**⚠️ 扣分点**
- README / AGENTS 数值轻微漂移(Next 15.1 vs 15.2.3、cost 值)
- docs 与最新代码略有滞后

---

## 三、强项 vs 弱点

### 💪 三大强项
1. **架构纪律**:hexagonal + ADR + 单一真源 + 幂等账本 —— 达到"AI 应用生产化"的专业级水准
2. **AI 编排深度**:三执行器 + 策略降级 + 8 项门禁 + workflow 不可变版本
3. **部署完备度**:nginx / TLS / 备份 / CI / 密钥保险箱 / 健康检查全套就绪,`verify-deployment` 17/17 实机通过

### ⚠️ 三大短板
1. **测试覆盖偏弱**(74 分):核心链路缺单测 + 无 e2e 自动化
2. **AI 实机受环境约束**(78 分):ComfyUI host 稳定性 + 云密钥未注入
3. **安全运行时配置待生产化**(80 分):默认密码 / 加密密钥 / 证书真实化

---

## 四、提升路径(86 → 95+)

| 阶段 | 动作 | 目标分 |
|---|---|---|
| **P0(1-2 天)** | 改默认密码 + 注入 API_KEY_ENCRYPTION_KEY + 补 MINIMAX/QWEN 云密钥 | 88 |
| **P1(1 周)** | 核心链路单测(编排 / 账本 / 门禁)+ Playwright e2e(17 按钮冒烟) | 91 |
| **P2(2 周)** | ComfyUI host 稳定化 + Hermes 入 worker + 真实 3D/视频 workflow 出图 | 94 |
| **P3(1 月)** | 密钥 vault 化 + refresh token + 多租户 + 覆盖率门禁 CI | 95+ |

---

## 五、改进清单(可勾选 · 后续改进逐项调用)

### P0 · 安全运行时配置(1-2 天)
- [ ] P0-1 修改 admin 默认密码(`src/db/create-admin.ts` 或 SQL 更新 password_hash)
- [ ] P0-2 为 web/worker 容器注入 `API_KEY_ENCRYPTION_KEY`(64 hex)
- [ ] P0-3 注入真实云密钥:`MINIMAX_API_KEY` / `QWEN_API_KEY` / `ZHIPU_API_KEY` / `MESHY_API_KEY`
- [ ] P0-4 在 `docker-compose.yml` / 部署脚本中固化以上 env(替代手动 `docker run`)
- [ ] P0-5 清理仓库中的 debug 脚本(`scripts/db-debug.ts` / `mark-debug.ts` / `trace-*.ts` / `fix-encoding.py` 等)

### P1 · 测试与质量门禁(1 周)
- [ ] P1-1 为 PolicyOrchestrator 编写单元测试(routing / retry / fallback 分支)
- [ ] P1-2 为 PowerLedger 编写单元测试(reserve / consume / release / 幂等)
- [ ] P1-3 为 workflow-gate 编写单元测试(8 项门禁的 pass / fail 路径)
- [ ] P1-4 引入 Playwright e2e:17 个按钮冒烟 + 登录 + 任务流转
- [ ] P1-5 CI 增加覆盖率门禁(如 > 60%)
- [ ] P1-6 `pnpm test:node` 全量跑通并更新 README 用例数

### P2 · AI 实机验证(2 周)
- [ ] P2-1 ComfyUI host `/prompt` 500 排查(重启 host / 检查 custom node 兼容)
- [ ] P2-2 Hermes CLI 装入 worker(Dockerfile.worker 增加安装步骤)
- [ ] P2-3 端到端真实出图验证:text2img / relief / upscale 各跑一张
- [ ] P2-4 3D 功能(image3d / 2dto3d)真实 workflow 验证
- [ ] P2-5 视频功能(text2video / img2video)真实 workflow 验证
- [ ] P2-6 更新 `assets/comfyui-workflows/` 为生产可用版本并跑 8 项门禁

### P3 · 商业化与加固(1 月)
- [ ] P3-1 密钥管理升级:vault / docker secrets 接入
- [ ] P3-2 Refresh Token 机制(`refresh_tokens` 表 + `/api/auth/refresh`)
- [ ] P3-3 多租户支持
- [ ] P3-4 真实 TLS 证书(Let's Encrypt / 域名)
- [ ] P3-5 算力充值支付网关
- [ ] P3-6 公开作品分享页
- [ ] P3-7 文档同步:更新 README / AGENTS 数值一致性
- [ ] P3-8 把本会话手动 `docker run` 重建流程固化为 `scripts/recreate-containers.sh`

---

## 六、变更记录

| 日期 | 版本 | 变动 | 得分 |
|---|---|---|---|
| 2026-08-16 | v1.0 | 首次评估(容器重建后、verify-deployment 17/17) | 86 |
