/**
 * Phase 6 · PowerLedger 单测
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/power-ledger.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PowerLedger } from '@/lib/ai/application/power-ledger';

describe('PowerLedger · 三态生命周期（内存降级）', () => {
  let ledger: PowerLedger;

  beforeEach(() => {
    ledger = new PowerLedger();
  });

  it('reserve 成功 → reserved 状态', async () => {
    const r = await ledger.reserve({
      userId: 'u1',
      featureId: 'text2img',
      amount: 15,
      taskId: 'task-1',
    });
    expect(r.success).toBe(true);
    expect(r.reservation?.status).toBe('reserved');
    expect(r.reservation?.amount).toBe(15);
  });

  it('同任务重复 reserve → 返回同一预留（幂等防双扣）', async () => {
    const r1 = await ledger.reserve({
      userId: 'u1',
      featureId: 'text2img',
      amount: 15,
      taskId: 'task-dup',
    });
    const r2 = await ledger.reserve({
      userId: 'u1',
      featureId: 'text2img',
      amount: 15,
      taskId: 'task-dup',
    });
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r2.reservation?.id).toBe(r1.reservation?.id);
  });

  it('release 释放预留（不扣减）', async () => {
    const r = await ledger.reserve({
      userId: 'u1',
      featureId: 'text2img',
      amount: 15,
      taskId: 'task-rel',
    });
    const s = await ledger.settle(r.reservation!.id, 'release');
    expect(s.success).toBe(true);
  });

  it('consume 结算预留', async () => {
    const r = await ledger.reserve({
      userId: 'u1',
      featureId: 'text2img',
      amount: 15,
      taskId: 'task-con',
    });
    const s = await ledger.settle(r.reservation!.id, 'consume');
    expect(s.success).toBe(true);
  });

  it('重复 settle → 报错（已结算）', async () => {
    const r = await ledger.reserve({
      userId: 'u1',
      featureId: 'text2img',
      amount: 15,
      taskId: 'task-2x',
    });
    const s1 = await ledger.settle(r.reservation!.id, 'release');
    expect(s1.success).toBe(true);
    const s2 = await ledger.settle(r.reservation!.id, 'consume');
    expect(s2.success).toBe(false);
    expect(s2.error).toContain('已结算');
  });

  it('按任务查预留 findByTask', async () => {
    await ledger.reserve({
      userId: 'u1',
      featureId: 'relief',
      amount: 20,
      taskId: 'task-find',
    });
    const found = await ledger.findByTask('u1', 'task-find');
    expect(found).not.toBeNull();
    expect(found?.featureId).toBe('relief');
  });
});
