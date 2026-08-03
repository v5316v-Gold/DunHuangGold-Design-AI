import type { Executor, FeatureExecutionRequest, FeatureExecutionResult } from '../types';
import { FEATURE_LIST } from '@/config/features';
export class MockExecutor implements Executor {
  readonly type = 'mock' as const;
  readonly id = 'mock-local';
  capabilities() {
    return new Set(FEATURE_LIST.map((feature) => feature.id));
  }
  async execute(req: FeatureExecutionRequest): Promise<FeatureExecutionResult> {
    const started = Date.now();
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
