// O9 合并双 orchestrator
import type { Executor } from '@/lib/ai/ports/executor.port';
import type { FeatureExecutionRequest, FeatureExecutionResult } from '../types';
import { FEATURE_LIST } from '@/config/features';

/**
 * MockExecutor — 仅限开发/测试环境
 *
 * Phase 9.22 加固（ADR-010）：
 * 生产环境（NODE_ENV=production）直接拒绝执行并返回错误，
 * 严禁 mock 成功冒充生产结果。
 */
export class MockExecutor implements Executor {
  readonly type = 'mock' as const;
  readonly id = 'mock';
  readonly productionSafe = false; // ADR-010: mock 仅限非生产

  capabilities() {
    return new Set(FEATURE_LIST.map((feature) => feature.id));
  }

  async execute(req: FeatureExecutionRequest): Promise<FeatureExecutionResult> {
    const started = Date.now();

    // G2 加固: 生产环境严禁 mock 成功（除非显式 ALLOW_MOCK_IN_PRODUCTION=true 灰度）
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_IN_PRODUCTION !== 'true') {
      return {
        success: false,
        executorUsed: this.type,
        provider: this.id,
        error: {
          code: 'MOCK_FORBIDDEN',
          message: '生产环境禁止使用 MockExecutor（ADR-010）',
          retryable: false,
        },
        cost: 0,
        latencyMs: Date.now() - started,
        traceId: req.traceId,
      };
    }

    return {
      success: true,
      executorUsed: this.type,
      provider: this.id,
      artifacts: [
        {
          url: `/api/placeholder?feature=${encodeURIComponent(req.featureId)}`,
          mime: 'application/json',
          metadata: { mock: true },
        },
      ],
      cost: 0,
      latencyMs: Date.now() - started,
      traceId: req.traceId,
    };
  }
}
