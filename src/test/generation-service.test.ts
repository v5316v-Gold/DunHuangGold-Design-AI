/**
 * Phase 3 · GenerationService 单测
 *
 * Exit criteria（EXECUTION-PLAN Phase 3）：
 *   - 一个 generation 生命周期（create → query → cancel/retry → settlePower）
 *   - 新旧端点行为一致（同步 executeSync / 异步 create）
 *   - 重复提交不双扣（幂等）
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/generation-service.test.ts
 * （node 环境：generation-service 依赖 node:crypto）
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { generationService } from '@/lib/ai/application/generation-service';
import { memoryTasks } from '@/lib/queue/memory-task-store';

// tasks.user_id 有 FK → users.id；TEST_USER_ID 必须是已存在的 user
// beforeAll 在 dev DB 插入一个幂等测试 user（如果已存在就跳过）
beforeAll(async () => {
  const { db } = await import('@/db');
  const { users } = await import('@/db/schema/_tables');
  const { eq } = await import('drizzle-orm');
  await db
    .insert(users)
    .values({
      id: TEST_USER_ID,
      email: 'test-user@vitest.local',
      passwordHash: 'x',
      nickname: 'vitest-test',
      role: 'user',
      status: 'active',
      power: 10000,
    })
    .onConflictDoNothing();
});

// Mock 队列（避免真实 Redis/BullMQ）
vi.mock('@/lib/queue/task-queue', () => {
  const state: Record<string, string> = {};
  return {
    enqueueTask: vi.fn(async (payload: { taskId: string; idempotencyKey: string }) => {
      if (state[payload.idempotencyKey]) {
        return { jobId: '', taskId: payload.taskId, duplicate: true };
      }
      state[payload.idempotencyKey] = '1';
      return { jobId: payload.taskId, taskId: payload.taskId, duplicate: false };
    }),
    releaseIdempotency: vi.fn(async (key: string) => {
      delete state[key];
    }),
  };
});

// Mock 算力
vi.mock('@/lib/ai-service/power-helper', () => ({
  checkUserPower: vi.fn(async () => true),
  deductUserPower: vi.fn(async () => ({ success: true })),
  refundUserPower: vi.fn(async () => ({ success: true })),
}));

// Mock 审计
vi.mock('@/lib/audit-logger', () => ({
  logAudit: vi.fn(async () => undefined),
}));

// Mock policy-orchestrator（executeSync 走它；feature-orchestrator 已删除）
vi.mock('@/lib/ai/orchestration/policy-orchestrator', () => ({
  policyOrchestrator: {
    execute: vi.fn(async (req: { traceId: string }) => ({
      success: true,
      executorUsed: 'mock',
      provider: 'mock',
      cost: 10,
      latencyMs: 5,
      traceId: req.traceId,
      artifacts: [{ url: 'https://example.com/a.png', mime: 'image/png' }],
    })),
    buildPlan: vi.fn(async (req: { featureId: string }) => ({
      taskId: `plan_${req.featureId}`,
      featureId: req.featureId,
      executorId: 'mock',
      fallbackChain: [],
      estimatedCost: 10,
      inputsSnapshot: {},
      planVersion: 1,
      createdAt: new Date().toISOString(),
    })),
  },
}));

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';
describe('GenerationService · create（异步任务创建）', () => {
  beforeEach(() => vi.clearAllMocks());

  it('缺少 featureId → INVALID_INPUT', async () => {
    const r = await generationService.create(TEST_USER_ID, { featureId: '', params: {} }, { requestId: 'r1' });
    expect(r.success).toBe(false);
    expect(r.code).toBe('INVALID_INPUT');
  });

  it('未知服务类型 → INVALID_INPUT', async () => {
    const r = await generationService.create(TEST_USER_ID, { featureId: 'not-a-service', params: {} }, { requestId: 'r1' });
    expect(r.success).toBe(false);
    expect(r.code).toBe('INVALID_INPUT');
  });

  it('正常创建 → taskId + pending', async () => {
    const r = await generationService.create(
      TEST_USER_ID,
      { featureId: 'text2img', params: { prompt: 'hello' } },
      { requestId: 'r1' }
    );
    expect(r.success).toBe(true);
    expect(r.taskId).toBeTruthy();
    expect(r.status).toBe('pending');
  });

  it('重复提交（同用户同参数）→ duplicate，不创建新任务', async () => {
    const input = { featureId: 'text2img', params: { prompt: 'same' } };
    const r1 = await generationService.create(TEST_USER_ID, input, { requestId: 'r1' });
    const r2 = await generationService.create(TEST_USER_ID, input, { requestId: 'r2' });
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(false);
    expect(r2.code).toBe('DUPLICATE_REQUEST');
    expect(r2.duplicate).toBe(true);
  });

  it('不同用户同参数 → 不冲突（幂等键含 userId）', async () => {
    const input = { featureId: 'text2img', params: { prompt: 'diff-user' } };
    const r1 = await generationService.create(TEST_USER_ID, input, { requestId: 'r1' });
    const r2 = await generationService.create('u2', input, { requestId: 'r2' });
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });
});

describe('GenerationService · query / cancel / retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清空内存任务表（DB 不可用时）
    memoryTasks.clear();
  });

  it('查询不存在的任务 → found=false', async () => {
    const r = await generationService.query(TEST_USER_ID, 'no-such-id', { requestId: 'r1' });
    expect(r.found).toBe(false);
  });

  it('查询自己的内存任务 → 返回状态', async () => {
    const created = await generationService.create(
      TEST_USER_ID,
      { featureId: 'relief', params: { prompt: 'x' } },
      { requestId: 'r1' }
    );
    const q = await generationService.query(TEST_USER_ID, created.taskId!, { requestId: 'r2' });
    expect(q.found).toBe(true);
    expect(q.owned).toBe(true);
    expect(q.task?.status).toBe('pending');
    expect(q.task?.type).toBe('relief');
  });

  it('查询他人任务 → owned=false', async () => {
    const created = await generationService.create(
      TEST_USER_ID,
      { featureId: 'relief', params: { prompt: 'y' } },
      { requestId: 'r1' }
    );
    const q = await generationService.query('u2', created.taskId!, { requestId: 'r2' });
    expect(q.found).toBe(true);
    expect(q.owned).toBe(false);
  });

  it('取消 pending 任务 → cancelled', async () => {
    const created = await generationService.create(
      TEST_USER_ID,
      { featureId: 'relief', params: { prompt: 'z' } },
      { requestId: 'r1' }
    );
    const r = await generationService.cancel(TEST_USER_ID, created.taskId!, { requestId: 'r2' });
    expect(r.success).toBe(true);
    expect(r.status).toBe('cancelled');
    // 验证内存态已更新
    const q = await generationService.query(TEST_USER_ID, created.taskId!, { requestId: 'r3' });
    expect(q.task?.status).toBe('cancelled');
  });

  it('取消他人任务 → PERMISSION_DENIED', async () => {
    const created = await generationService.create(
      TEST_USER_ID,
      { featureId: 'relief', params: { prompt: 'w' } },
      { requestId: 'r1' }
    );
    const r = await generationService.cancel('u2', created.taskId!, { requestId: 'r2' });
    expect(r.success).toBe(false);
    expect(r.code).toBe('PERMISSION_DENIED');
  });

  it('重试失败任务 → 重新入队', async () => {
    const created = await generationService.create(
      TEST_USER_ID,
      { featureId: 'relief', params: { prompt: 'retry-me' } },
      { requestId: 'r1' }
    );
    // 任务落 DB（beforeAll 插了 test user）；用 DB update 把状态改为 failed，然后 retry 走 DB 查询
    const { db } = await import('@/db');
    const { tasks } = await import('@/db/schema/_tables');
    const { eq } = await import('drizzle-orm');
    await db.update(tasks).set({ status: 'failed', error: 'boom' }).where(eq(tasks.id, created.taskId!));
    const r = await generationService.retry(TEST_USER_ID, created.taskId!, { requestId: 'r2' });
    expect(r.success).toBe(true);
    const q = await generationService.query(TEST_USER_ID, created.taskId!, { requestId: 'r3' });
    expect(q.task?.status).toBe('pending');
  });
});

describe('GenerationService · executeSync（同步兼容）', () => {
  beforeEach(() => vi.clearAllMocks());

  it('同步执行成功 → 返回 orchestrator 结果', async () => {
    const r = await generationService.executeSync(
      TEST_USER_ID,
      { featureId: 'text2img', params: { prompt: 'sync' } },
      { requestId: 'r1' }
    );
    expect(r.success).toBe(true);
    expect(r.result).toBeTruthy();
    expect(r.traceId).toBe('r1'); // mock 透传请求的 traceId
  });

  it('同步执行有 traceId 贯通', async () => {
    const r = await generationService.executeSync(
      TEST_USER_ID,
      { featureId: 'text2img', params: { prompt: 'sync2' } },
      { requestId: 'r1', traceId: 'trace-custom' }
    );
    expect(r.traceId).toBe('trace-custom');
  });
});
