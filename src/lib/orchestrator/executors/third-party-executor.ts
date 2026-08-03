import type { Executor, FeatureExecutionRequest, FeatureExecutionResult } from '../types';
import { FEATURE_LIST } from '@/config/features';
export class ThirdPartyExecutor implements Executor {
  readonly type = 'third-party' as const;
  readonly id = 'gateway';
  capabilities() {
    return new Set(FEATURE_LIST.map((feature) => feature.id));
  }
  async execute(req: FeatureExecutionRequest): Promise<FeatureExecutionResult> {
    return {
      success: false,
      executorUsed: this.type,
      provider: 'gateway',
      error: {
        code: 'THIRD_PARTY_NOT_CONFIGURED',
        message: `第三方执行器尚未配置 feature=${req.featureId}`,
        retryable: true,
      },
      cost: 0,
      latencyMs: 0,
      traceId: req.traceId,
    };
  }
}
