/**
 * Phase 8 · Telemetry 单测
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/telemetry.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { computeTimings } from '@/lib/ai/application/telemetry';

describe('telemetry · computeTimings', () => {
  it('completedAt 存在 → 计算总耗时', () => {
    const start = new Date('2026-08-04T10:00:00.000Z');
    const end = new Date('2026-08-04T10:00:05.000Z');
    const t = computeTimings(start, end);
    expect(t.totalMs).toBe(5000);
  });

  it('completedAt 为空 → 用当前时间', () => {
    const start = new Date(Date.now() - 1000);
    const t = computeTimings(start);
    expect(t.totalMs).toBeGreaterThanOrEqual(1000);
  });

  it('createdAt 为字符串 ISO', () => {
    const t = computeTimings('2026-08-04T10:00:00.000Z', '2026-08-04T10:00:02.000Z');
    expect(t.totalMs).toBe(2000);
  });
});
