/**
 * Phase 6 · PowerLedger 单测
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/power-ledger.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('consume 幂等：重复 consume 不重复扣减', async () => {
    const r = await ledger.reserve({
      userId: 'u1',
      featureId: 'text2img',
      amount: 15,
      taskId: 'task-2x',
    });
    const s1 = await ledger.settle(r.reservation!.id, 'consume');
    const s2 = await ledger.settle(r.reservation!.id, 'consume');
    expect(s1.success).toBe(true);
    // Phase 修复：consume 改为幂等 no-op，Worker 重试不会重复扣减
    expect(s2.success).toBe(true);
  });

  it('release 后仍可 consume（重试场景：失败释放 → 重试成功再扣）', async () => {
    const r = await ledger.reserve({
      userId: 'u1',
      featureId: 'text2img',
      amount: 15,
      taskId: 'task-retry',
    });
    await ledger.settle(r.reservation!.id, 'release');
    const s = await ledger.settle(r.reservation!.id, 'consume');
    expect(s.success).toBe(true);
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

describe('PowerLedger · 边界与幂等（P1 补测）', () => {
  let ledger: PowerLedger;

  beforeEach(() => {
    ledger = new PowerLedger();
  });

  it('release 幂等：重复 release 不报错、状态不回退', async () => {
    const r = await ledger.reserve({
      userId: 'u1',
      featureId: 'text2img',
      amount: 15,
      taskId: 'task-rel2',
    });
    const s1 = await ledger.settle(r.reservation!.id, 'release');
    const s2 = await ledger.settle(r.reservation!.id, 'release');
    expect(s1.success).toBe(true);
    expect(s2.success).toBe(true);
    // 状态已释放（内存态可验证）
    const after = await ledger.findByTask('u1', 'task-rel2');
    expect(after?.status).toBe('released');
  });

  it('consume 后 release → no-op（consumed 不回退到 released）', async () => {
    const r = await ledger.reserve({
      userId: 'u1',
      featureId: 'text2img',
      amount: 15,
      taskId: 'task-cr',
    });
    await ledger.settle(r.reservation!.id, 'consume');
    const rel = await ledger.settle(r.reservation!.id, 'release');
    expect(rel.success).toBe(true);
    const after = await ledger.findByTask('u1', 'task-cr');
    expect(after?.status).toBe('consumed'); // 不回退
  });

  it('余额不足 → reserve 拒绝（INSUFFICIENT）', async () => {
    // 内存态 getBalance 返回 null（fail-open），此处用 spy 模拟余额 5 < 15
    const spy = vi.spyOn(ledger, 'getBalance').mockResolvedValue(5);
    const r = await ledger.reserve({
      userId: 'u1',
      featureId: 'text2img',
      amount: 15,
      taskId: 'task-poor',
    });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/算力不足/);
    spy.mockRestore();
  });

  it('余额恰好等于金额 → reserve 成功（边界 >=）', async () => {
    const spy = vi.spyOn(ledger, 'getBalance').mockResolvedValue(15);
    const r = await ledger.reserve({
      userId: 'u1',
      featureId: 'text2img',
      amount: 15,
      taskId: 'task-eq',
    });
    expect(r.success).toBe(true);
    spy.mockRestore();
  });

  it('findByTask 未找到 → null', async () => {
    const found = await ledger.findByTask('u1', 'no-such-task');
    expect(found).toBeNull();
  });

  it('settle 不存在的预留 → 返回错误', async () => {
    const s = await ledger.settle('no-such-reservation-id', 'consume');
    expect(s.success).toBe(false);
    expect(s.error).toMatch(/预留不存在/);
  });

  it('不同用户同 taskId 互不可见（隔离性）', async () => {
    await ledger.reserve({
      userId: 'u1',
      featureId: 'relief',
      amount: 20,
      taskId: 'task-shared',
    });
    const foundByU2 = await ledger.findByTask('u2', 'task-shared');
    expect(foundByU2).toBeNull();
  });
});
