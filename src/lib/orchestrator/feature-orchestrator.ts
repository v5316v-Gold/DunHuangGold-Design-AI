import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { features } from '@/db/schema/features';
import { FEATURE_DEFINITIONS } from '@/config/features';
import { getFeatureCost } from '@/lib/feature-costs';
import { logAudit } from '@/lib/audit-logger';
import { MockExecutor } from './executors/mock-executor';
import { ComfyUIExecutor } from './executors/comfyui-executor';
import { ThirdPartyExecutor } from './executors/third-party-executor';
import type {
  Executor,
  ExecutorType,
  FeatureExecutionRequest,
  FeatureExecutionResult,
} from './types';

export class FeatureOrchestrator {
  private readonly executors = new Map<ExecutorType, Executor>([
    ['mock', new MockExecutor()],
    ['comfyui', new ComfyUIExecutor()],
    ['third-party', new ThirdPartyExecutor()],
  ]);
  private async loadFeatureConfig(featureId: string) {
    if (db) {
      try {
        const rows = await db.select().from(features).where(eq(features.id, featureId)).limit(1);
        if (rows[0]) return rows[0];
      } catch (error) {
        // DB 连接失败 → 退回配置层定义（fail-open，同 power-helper）
        console.warn(`[orchestrator] DB 查询功能配置失败，使用配置兜底: ${featureId}`, error);
      }
    }
    const definition = FEATURE_DEFINITIONS[featureId];
    return definition
      ? {
          id: featureId,
          name: definition.name,
          description: definition.description,
          category: definition.category,
          enabled: true,
          defaultExecutor: 'third-party',
          fallbackExecutors: ['comfyui', 'mock'],
          cost: getFeatureCost(featureId),
        }
      : null;
  }
  async execute(req: FeatureExecutionRequest): Promise<FeatureExecutionResult> {
    const feature = await this.loadFeatureConfig(req.featureId);
    if (!feature) return this.fail(req, 'FEATURE_NOT_FOUND', `功能 ${req.featureId} 不存在`, false);
    if (!feature.enabled)
      return this.fail(req, 'FEATURE_DISABLED', `功能 ${req.featureId} 已被关闭`, false);
    const chain = [
      feature.defaultExecutor as ExecutorType,
      ...((feature.fallbackExecutors || []) as ExecutorType[]),
    ];
    for (const type of chain) {
      const executor = this.executors.get(type);
      if (!executor || !executor.capabilities().has(req.featureId)) continue;
      try {
        const result = await executor.execute({ ...req, _feature: feature });
        if (result.success) {
          await logAudit({
            action: 'feature.execute',
            resourceType: 'feature',
            resourceId: req.featureId,
            actorId: req.userId,
            details: { executorUsed: result.executorUsed, cost: result.cost },
          });
          return result;
        }
        if (!result.error?.retryable) return result;
      } catch (error) {
        console.error(`[orchestrator] ${type} 异常`, error);
      }
    }
    return this.fail(req, 'ALL_EXECUTORS_FAILED', '所有执行器都失败', true);
  }
  private fail(
    req: FeatureExecutionRequest,
    code: string,
    message: string,
    retryable: boolean
  ): FeatureExecutionResult {
    return {
      success: false,
      error: { code, message, retryable },
      executorUsed: 'mock',
      cost: 0,
      latencyMs: 0,
      traceId: req.traceId,
    };
  }
}
export const orchestrator = new FeatureOrchestrator();
