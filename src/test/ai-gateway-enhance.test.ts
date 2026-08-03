/**
 * AI Gateway 增强模块验收测试
 *
 * 覆盖：
 * 1. AIGatewayRouter 路由策略（priority / least_busy / lowest_latency）
 * 2. 熔断逻辑（连续失败 → 熔断 → 冷却恢复）
 * 3. ProviderHealthMonitor 健康检查
 * 4. PowerQuota 配额检查
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIGatewayRouter } from '@/lib/ai-gateway/router-strategy';
import { ProviderHealthMonitor } from '@/lib/ai-gateway/provider-health';
import { checkQuota, quotaErrorMessage } from '@/lib/power/quota';

// ============================================================
// Router 策略
// ============================================================

describe('AIGatewayRouter · 路由策略', () => {
  const router = new AIGatewayRouter();

  beforeEach(() => {
    router.register('text2img', {
      strategy: 'priority',
      priorityChain: ['minimax', 'comfyui', 'mock'],
      failThreshold: 3,
      cooldownMs: 60000,
      windowMs: 60000,
    });
  });

  it('priority 策略按配置顺序返回', async () => {
    const selected = await router.select('text2img');
    expect(selected).toBe('minimax');
  });

  it('least_busy 策略选负载最低的', async () => {
    router.register('refine', {
      strategy: 'least_busy',
      priorityChain: ['comfyui', 'minimax'],
      failThreshold: 3,
      cooldownMs: 60000,
      windowMs: 60000,
    });
    // comfyui 有 2 个 inflight，minimax 0 个
    router.begin('comfyui');
    router.begin('comfyui');
    const selected = await router.select('refine');
    expect(selected).toBe('minimax');
  });

  it('熔断后跳过失败 provider', async () => {
    // 连续 3 次失败 comfyui
    router.end('comfyui', false, 100);
    router.end('comfyui', false, 100);
    router.end('comfyui', false, 100);

    // priority 链但 comfyui 应被跳过
    router.register('sketch', {
      strategy: 'priority',
      priorityChain: ['comfyui', 'minimax', 'mock'],
      failThreshold: 3,
      cooldownMs: 60000,
      windowMs: 60000,
    });
    const selected = await router.select('sketch');
    expect(selected).toBe('minimax');
  });

  it('成功重置失败计数', async () => {
    router.end('minimax', false, 100);
    router.end('minimax', false, 100);
    router.end('minimax', true, 50);  // 成功
    // 失败计数应重置
    const stats = router.getStats()['minimax'];
    expect(stats.failCount).toBe(0);
    expect(stats.healthy).toBe(true);
  });

  it('未知 feature 返回 null', async () => {
    const selected = await router.select('unknown-feature');
    expect(selected).toBeNull();
  });
});

// ============================================================
// 健康检查
// ============================================================

describe('ProviderHealthMonitor · 健康检查', () => {
  const monitor = new ProviderHealthMonitor();

  it('注册探针并检查', async () => {
    monitor.register({
      provider: 'test-ok',
      check: async () => true,
    });
    monitor.register({
      provider: 'test-fail',
      check: async () => false,
    });

    await monitor.checkAll();

    expect(monitor.isHealthy('test-ok')).toBe(true);
    expect(monitor.isHealthy('test-fail')).toBe(true);  // 1 次失败未熔断
  });

  it('连续失败 3 次熔断', async () => {
    monitor.register({
      provider: 'test-crash',
      check: async () => false,
    });

    await monitor.checkOne(monitor['probes'].get('test-crash')!);
    await monitor.checkOne(monitor['probes'].get('test-crash')!);
    await monitor.checkOne(monitor['probes'].get('test-crash')!);

    expect(monitor.isHealthy('test-crash')).toBe(false);
  });

  it('成功恢复健康', async () => {
    let healthy = true;
    monitor.register({
      provider: 'test-recover',
      check: async () => healthy,
    });
    const probe = monitor['probes'].get('test-recover')!;

    healthy = false;
    await monitor.checkOne(probe);
    await monitor.checkOne(probe);
    await monitor.checkOne(probe);
    expect(monitor.isHealthy('test-recover')).toBe(false);

    healthy = true;
    await monitor.checkOne(probe);
    expect(monitor.isHealthy('test-recover')).toBe(true);
  });
});

// ============================================================
// 算力配额
// ============================================================

describe('PowerQuota · 配额检查', () => {
  it('单任务超限被拒绝', async () => {
    const result = await checkQuota('user-1', 500, {
      dailyLimit: 1000,
      monthlyLimit: 20000,
      perTaskLimit: 200,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('per_task');
  });

  it('配额错误信息友好', () => {
    expect(quotaErrorMessage('daily', 100)).toContain('今日算力已达上限');
    expect(quotaErrorMessage('balance')).toContain('余额不足');
    expect(quotaErrorMessage('monthly')).toContain('本月算力已达上限');
    expect(quotaErrorMessage('per_task')).toContain('单任务算力超出');
  });
});