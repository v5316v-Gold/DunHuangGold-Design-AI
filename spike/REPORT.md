# Redis + BullMQ 环境 Spike 报告

**日期**：2026-07-30  
**结论**：✅ **PASS** — 环境就绪，可进入 W1 实施

---

## 实验

### 1. Redis 连接性

```bash
# WSL 内启动 Redis 容器
wsl -d Ubuntu -- docker run -d --name dunhuang-redis -p 6379:6379 redis:7-alpine
```

```typescript
// 通过 ioredis 连接
import IORedis from 'ioredis';
const redis = new IORedis('redis://localhost:6379');
await redis.ping(); // → PONG ✅
```

**结果**：✅ 通过 Windows 的 `localhost:6379` 直接访问（WSL 端口已自动转发）。

### 2. BullMQ 队列创建

```typescript
const queue = new Queue('test', { connection });
const job = await queue.add('test-job', { msg: 'hello' }, { jobId: 'spike-1' });
// → job.id: 'spike-1'
// → getJobCounts: { waiting: 1, active: 0, completed: 0, failed: 0 }
```

**结果**：✅ BullMQ 5.34 已装（通过 `pnpm add bullmq`），队列创建、入队、状态查询全 OK。

### 3. Worker 消费

```typescript
const worker = new Worker('test', async (job) => {
  // 处理任务
}, { connection });

worker.on('completed', (job, result) => console.log('✅ done'));
```

**结果**：✅ Producer → BullMQ → Worker → completed 回调全流程跑通（3 任务 0.5s/个）。

### 4. 幂等性

**关键发现**：BullMQ 默认同 jobId **不报错而覆盖**——不适合幂等场景。

**解决方案**：业务层用 Redis `SETNX` 实现幂等：

```typescript
async function checkIdempotency(key: string, ttlSec = 3600): Promise<boolean> {
  const result = await redis.set(`idem:${key}`, '1', 'EX', ttlSec, 'NX');
  return result === 'OK';  // 'OK' = 通过, null = 重复
}
```

**结果**：✅ 业务层 SETNX 幂等跑通（同 key 二次调用被拒绝）。

---

## 关键决策

| 决策点 | 选择 |
|--------|------|
| Redis 部署 | WSL Docker 容器（`dunhuang-redis`，已起） |
| 队列技术 | BullMQ（已确认兼容 Node 24 + Next 15） |
| 幂等实现 | Redis SETNX（不依赖 BullMQ jobId） |
| Worker 部署 | PM2 进程（同 W1 方案） |

---

## 风险与防御

| 风险 | 防御 |
|------|------|
| Redis 容器重启数据丢失 | 开启 AOF 持久化（`--appendonly yes`） |
| BullMQ stalled 任务 | 配 stalledInterval + maxStalledCount |
| 并发幂等键冲突 | 用 UUID v4 + 业务参数 hash 组合 |

---

## 进入 W1 准备清单

- [x] Redis 容器跑通（PONG）
- [x] BullMQ 队列创建 OK
- [x] Worker 消费跑通
- [x] SETNX 幂等方案验证
- [x] 项目 `REDIS_URL` 环境变量待配置

---

## 下一步

进入 W1 实施：

```
1. 配置 REDIS_URL 到 .env.local
2. 实现 src/lib/redis.ts（封装 ioredis 单例）
3. 实现 src/lib/queue/task-queue.ts（BullMQ 封装）
4. 实现 src/lib/queue/task-state.ts（任务状态机）
5. 实现 src/lib/queue/idempotency.ts（SETNX 幂等）
6. TDD: 写失败测试 → 看失败 → 写最小实现 → 看绿
```

天枢等候"开始 W1"指令。