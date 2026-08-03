# 敦煌金 AI 项目 · Worker 独立构建与部署（任务四）

> **执行时间**：2026-08-03
> **产物**：`Dockerfile.worker` + `scripts/build-workers.sh` + `scripts/verify-worker-mock.ts`

---

## 一、交付物

| 文件 | 说明 |
|---|---|
| `Dockerfile.worker` | Worker 专用镜像（3 阶段：deps → builder → runner） |
| `scripts/build-workers.sh` | 本地构建 worker 产物脚本（tsup 打包） |
| `scripts/verify-worker-mock.ts` | Worker mock 消费验证脚本 |
| `docker-compose.yml` | worker service 改用 Dockerfile.worker + dist-workers 路径 |
| `workers/orchestrator-worker.ts` | 修复队列名 bug + 优雅关闭 |

## 二、Worker 独立构建验证

```bash
bash scripts/build-workers.sh
```

**结果**：
```text
[1/3] 打包 orchestrator-worker...   → tsup v8.5.1, CJS build
CJS dist-workers/orchestrator-worker.js  52.22 KB
[2/3] 验证产物...  → ✅ 53,840 bytes
[3/3] 语法校验...  → ✅ node --check 通过
```

- 产物：`dist-workers/orchestrator-worker.js`（52 KB，自包含，别名已解析）
- 耗时：66 ms
- tsup 配置：CJS + node20 + external(pg/bcryptjs/ioredis)

## 三、环境变量读取验证

```bash
node dist-workers/orchestrator-worker.js
```
**结果**：
```text
⚠️ DATABASE_URL 未配置，数据库功能将不可用   ← 正常读取 env 并降级
[worker] orchestrator-worker 启动，队列: ai-tasks   ← 启动成功
[ioredis] ECONNREFUSED   ← 预期（本地无 Redis）
```

✅ Worker 正确读取环境变量、无队列名错误、启动后尝试连接 Redis

## 四、Redis 连接 + Mock 消费验证

### 队列名 bug 修复（重要发现）
**问题**：原代码队列名 `generation:v2` 含冒号 → BullMQ 抛 `Queue name cannot contain ':'`
**修复**：改为 `ai-tasks`（与 Producer `src/lib/queue/task-queue.ts` 的 QUEUE_NAME 一致）

### Mock 消费验证（`npx tsx scripts/verify-worker-mock.ts`）
```text
1. MockExecutor capabilities: 17 个
   包含 text2img: true | 包含 tryon: true | 包含 relief: true
2. Mock 任务消费结果:
   success: true | executorUsed: mock | cost: 0
   artifacts: [{"url":"/api/placeholder?feature=text2img",...}]
✅ Worker mock 消费验证通过
3. tryon mock 消费: success=true
```

## 五、Docker 部署说明

### 构建镜像
```bash
docker build -f Dockerfile.worker -t dunhuang-ai-worker:latest .
```

### 运行（docker-compose 自动）
```bash
docker compose up -d worker
```
或单独运行：
```bash
docker run --rm \
  -e NODE_ENV=production \
  -e REDIS_URL=redis://host:6379 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e JWT_SECRET=<32+ chars> \
  -e API_KEY_ENCRYPTION_KEY=<32 bytes hex> \
  dunhuang-ai-worker:latest
```

### 镜像结构
| 阶段 | 内容 |
|---|---|
| deps | pnpm install --frozen-lockfile |
| builder | tsup 打包 worker（52 KB） |
| runner | node:20-alpine + 产物 + 运行时依赖（pg/bcryptjs/ioredis） |

### 生产注意事项
1. **Redis 必须先就绪**（compose 已配 `condition: service_healthy`）
2. **JWT_SECRET / API_KEY_ENCRYPTION_KEY 必须注入**（与 Web 一致）
3. **横向扩容**：`docker compose up -d --scale worker=3`（BullMQ 天然支持多实例消费）
4. **日志**：worker stdout 输出 `[worker]` 前缀，可接 ELK/Loki

## 六、验证清单

- [x] Worker 可独立构建（tsup 52 KB，66ms）
- [x] 产物语法校验通过（node --check）
- [x] 环境变量读取正常（DATABASE_URL 降级提示）
- [x] 队列名无冒号（修复 generation:v2 bug）
- [x] 启动后尝试连接 Redis（ECONNREFUSED 预期）
- [x] Mock 任务消费成功（17 功能 + tryon）
- [x] docker-compose worker service 指向新镜像
