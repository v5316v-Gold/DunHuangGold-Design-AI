/**
 * Phase 8.5 · Telemetry（14 字段任务追踪）
 *
 * Spec: 04-L3 §14 + EXECUTION-PLAN Phase 8.5
 *
 * 14 字段：
 *   requestId traceId taskId generationId userId featureId executorId
 *   providerId workflowVersion modelVersions queueWaitMs executionMs
 *   postProcessMs totalMs attempt estimatedCost actualCost failureCode
 *
 * DB 不可用 → 结构化日志兜底（JSON）。
 */

import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('telemetry');

export interface TelemetryRecord {
  requestId?: string;
  traceId?: string;
  taskId?: string;
  generationId?: string;
  userId?: string;
  featureId?: string;
  executorId?: string;
  providerId?: string;
  workflowVersion?: number;
  modelVersions?: string[];
  queueWaitMs?: number;
  executionMs?: number;
  postProcessMs?: number;
  totalMs?: number;
  attempt?: number;
  estimatedCost?: number;
  actualCost?: number;
  failureCode?: string;
  /** 附加信息（不入 14 字段，但可追踪） */
  meta?: Record<string, unknown>;
}

/**
 * 记录 telemetry：优先落库（telemetry 表），DB 不可用 → JSON 日志
 */
export async function recordTelemetry(record: TelemetryRecord): Promise<void> {
  const flat: Record<string, unknown> = { ...record };

  if (db) {
    try {
      // 落库到 telemetry 表（若表存在；不存在则静默降级日志）
      await db.execute(sql`
        insert into telemetry (
          request_id, trace_id, task_id, generation_id, user_id, feature_id,
          executor_id, provider_id, workflow_version, model_versions,
          queue_wait_ms, execution_ms, post_process_ms, total_ms,
          attempt, estimated_cost, actual_cost, failure_code
        ) values (
          ${record.requestId ?? null}, ${record.traceId ?? null},
          ${record.taskId ?? null}, ${record.generationId ?? null},
          ${record.userId ?? null}, ${record.featureId ?? null},
          ${record.executorId ?? null}, ${record.providerId ?? null},
          ${record.workflowVersion ?? null},
          ${record.modelVersions ? JSON.stringify(record.modelVersions) : null},
          ${record.queueWaitMs ?? null}, ${record.executionMs ?? null},
          ${record.postProcessMs ?? null}, ${record.totalMs ?? null},
          ${record.attempt ?? null}, ${record.estimatedCost ?? null},
          ${record.actualCost ?? null}, ${record.failureCode ?? null}
        ) on conflict do nothing
      `);
      return;
    } catch {
      // 表不存在/DB 不可用 → 日志兜底
    }
  }

  logger.info('telemetry', { ...flat, ts: new Date().toISOString() });
}

/** 便捷：从任务创建到完成的耗时统计 */
export function computeTimings(createdAt: Date | string, completedAt?: Date | string | null) {
  const start = new Date(createdAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  return { totalMs: Math.max(0, end - start) };
}
