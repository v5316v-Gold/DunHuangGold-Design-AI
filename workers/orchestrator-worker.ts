import { Worker } from 'bullmq';
import { sql } from 'drizzle-orm';
import { hostname } from 'os';
import { randomUUID as rngUuid } from 'crypto';
// Phase 4：worker 走新 PolicyOrchestrator（策略驱动：routing/retry/fallback + ExecutionPlan）
// 旧 orchestrator（src/lib/orchestrator/feature-orchestrator）已冻结 deprecated
import { policyOrchestrator } from '@/lib/ai/orchestration/policy-orchestrator';
// Phase 9.26 · 必须注册 executors（否则 PolicyOrchestrator.executors 空 Map →
// decideFallback 永不推进 → 死循环 CPU 100%）
import '@/lib/ai/adapters/executor-registry';
import { getBullConnection } from '@/lib/redis';
import {
  markProcessing,
  markCompleted,
  markFailed,
  markDeadLetter,
} from '@/lib/queue/task-state';
import { createLogger } from '@/lib/error-handler';
import { generationService } from '@/lib/ai/application/generation-service';
import { db } from '@/db';
import { works } from '@/db/schema';
import { workerNodes } from '@/db/schema/_tables';

const logger = createLogger('orchestrator-worker');

// ============================================================
// 作品保存（任务完成 → works 表，供作品展示模块）
// ============================================================

interface SaveWorkParams {
  userId: string;
  featureId: string;
  params: Record<string, unknown>;
  output: Record<string, unknown>;
}

/**
 * 任务完成后把结果写入 works 表
 * - 图片功能 → output_image_url
 * - 3D 功能（relief/image3d） → output_model_url + output_image_url（预览）
 * - 视频功能 → output_video_url
 */
async function saveWorkRecord({
  userId,
  featureId,
  params,
  output,
}: SaveWorkParams): Promise<void> {
  if (!db) {
    logger.warn('[saveWorkRecord] DB 不可用，跳过作品保存');
    return;
  }

  const imageUrl: string | null = (output.imageUrl as string) || null;
  const modelUrl: string | null = (output.modelUrl as string) || null;
  const videoUrl: string | null =
    (output.videoUrl as string) || (output.video_url as string) || null;

  const isVideo = ['text2video', 'img2video'].includes(featureId);
  const is3D = ['relief', 'image3d', '2dto3d', 'stereo'].includes(featureId);

  const rawInputImage = params.image as string | undefined;
  const inputImage: string | null =
    rawInputImage
      ? rawInputImage.startsWith('data:')
        ? null // base64 不入库（体积大），真实 URL 才存
        : rawInputImage
      : null;

  await db.insert(works).values({
    userId: userId as any,
    title: output.title ? String(output.title) : featureId,
    type: featureId,
    featureCode: featureId,
    prompt: typeof params.prompt === 'string' ? params.prompt : null,
    inputImageUrl: inputImage,
    outputImageUrl: imageUrl,
    outputModelUrl: is3D ? modelUrl : null,
    outputVideoUrl: isVideo ? videoUrl : null,
    params: params as Record<string, unknown>,
    powerCost: (output.cost as number) ?? 0,
    status: 'completed',
    isPublic: false,
  }).execute();
}

// 队列名必须与 Producer（src/lib/queue/task-queue.ts 的 QUEUE_NAME）一致
// ⚠️ 不能包含冒号（BullMQ 限制：Queue name cannot contain ':'）
const QUEUE_NAME = 'ai-tasks';

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    logger.info(`[worker] 收到 BullMQ 任务, job.data=${JSON.stringify(job.data).substring(0, 500)}`);
    const featureId = job.data.featureId ?? job.data.serviceType;
    const userId = job.data.userId;
    const params = job.data.params ?? job.data.inputs ?? {};
    const taskId = job.data.taskId ?? job.id;
    const traceId = String(job.id ?? crypto.randomUUID());

    logger.info(`[worker] 开始处理任务 ${taskId} (${featureId})`);

    // 1. 标记处理中
    try {
      await markProcessing(String(taskId), Number(job.attemptsMade ?? 0) + 1);
    } catch (e) {
      logger.warn(`[worker] 标记 processing 失败: ${taskId}`, e as Error);
    }

    // 2. 执行（Phase 4：新 PolicyOrchestrator，策略驱动）
    logger.info(`[worker] 执行前: ${taskId} (${featureId}) params=${JSON.stringify(params).slice(0, 100)}`);
    const result = await policyOrchestrator.execute({
      featureId,
      userId,
      inputs: params,
      traceId,
    });
    logger.info(`[worker] 执行返回: ${taskId} success=${result.success} exec=${result.executorUsed} cost=${result.cost} latency=${result.latencyMs}ms`);

    // 3. 更新任务状态
    if (result.success) {
      const artifacts = result.artifacts || [];
      const firstArtifact = artifacts[0];
      const output: Record<string, unknown> = {
        executorUsed: result.executorUsed,
        provider: result.provider,
        artifacts: artifacts.map((a) => ({
          url: a.url,
          mime: a.mime,
          metadata: a.metadata,
        })),
        // 兼容旧前端：imageUrl 指向第一个产物
        imageUrl: firstArtifact?.url ?? null,
        modelUrl:
          artifacts.find((a) => a.mime?.includes('glb') || a.url?.includes('.glb'))?.url ??
          null,
        cost: result.cost,
        latencyMs: result.latencyMs,
      };

      try {
        await markCompleted(String(taskId), output);
      } catch (e) {
        logger.error(`[worker] 标记 completed 失败: ${taskId}`, e as Error);
        throw e;
      }

      // 结算算力（consume：预留 → 正式扣减，幂等；失败不阻断任务完成，由对账兜底）
      try {
        await generationService.settlePower(String(userId), String(taskId), 'consume');
      } catch (e) {
        logger.error(`[worker] 算力结算失败: ${taskId}`, e as Error);
      }

      // 4. 保存作品记录（作品展示模块数据源）
      try {
        await saveWorkRecord({
          userId,
          featureId,
          params,
          output,
        });
        logger.info(`[worker] 作品已保存: ${taskId} (${featureId})`);
      } catch (e) {
        logger.warn(`[worker] 作品保存失败（不阻断任务完成）: ${taskId}`, e as Error);
      }

      logger.info(`[worker] 任务完成: ${taskId} (${featureId})`);
      return output;
    }

    // 4. 失败处理
    const errorMessage = result.error?.message || '执行失败';
    const retryable = result.error?.retryable ?? false;
    const attempts = Number(job.attemptsMade ?? 0) + 1;
    const maxAttempts = job.opts?.attempts ?? 3;

    logger.warn(
      `[worker] 任务失败: ${taskId} (${featureId}) attempt=${attempts}/${maxAttempts} retryable=${retryable}: ${errorMessage}`
    );

    if (retryable && attempts < maxAttempts) {
      // 可重试：抛错触发 BullMQ 重试，标记 failed（保留重试链）
      try {
        await markFailed(String(taskId), errorMessage, attempts);
      } catch (e) {
        logger.warn(`[worker] 标记 failed 失败: ${taskId}`, e as Error);
      }
      throw new Error(errorMessage);
    }

    // 不可重试或重试耗尽：标记 dead_letter（保持 BullMQ failed 状态）
    try {
      await markDeadLetter(String(taskId), errorMessage);
    } catch (e) {
      logger.warn(`[worker] 标记 dead_letter 失败: ${taskId}`, e as Error);
    }
    // 释放算力预留（失败 → release，不扣减）
    try {
      await generationService.settlePower(String(userId), String(taskId), 'release');
    } catch (e) {
      logger.warn(`[worker] 释放预留失败: ${taskId}`, e as Error);
    }
    throw new Error(errorMessage);
  },
  {
    connection: getBullConnection(),
    concurrency: 4,
    // 长任务（视频/3D 最长 120s）避免被 30s 默认 stalled 判定重复执行
    stalledInterval: 130_000,
    maxStalledCount: 1,
  }
);

worker.on('failed', (job, error) =>
  logger.error(`[worker] ${job?.id} 失败: ${error.message}`)
);
worker.on('completed', (job) =>
  logger.info(`[worker] ${job.id} 完成`)
);
worker.on('ready', () =>
  logger.info(`[worker] 就绪，监听队列: ${QUEUE_NAME}`)
);

// 优雅关闭
async function shutdown() {
  logger.info('[worker] 关闭中...');
  stopHeartbeat();
  try {
    if (db) {
      await db.execute(sql`DELETE FROM worker_nodes WHERE id = ${nodeId}`);
    }
  } catch {
    // ignore
  }
  await worker.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

logger.info(`[worker] orchestrator-worker 启动，队列: ${QUEUE_NAME}`);

// ============================================================
// W1 · Worker 心跳上报（注册 + 定时刷新）
// ============================================================
const nodeId = process.env.WORKER_NODE_ID || `worker-${hostname()}-${process.pid}-${rngUuid().slice(0, 6)}`;
const nodeStartedAt = new Date();
let heartbeatTimer: NodeJS.Timeout | null = null;

async function registerHeartbeat(): Promise<void> {
  if (!db) {
    logger.warn('[worker] DB 不可用，跳过心跳注册（健康检查将无法识别本 worker）');
    return;
  }
  try {
    await db
      .insert(workerNodes)
      .values({
        id: nodeId,
        hostname: hostname(),
        pid: process.pid,
        queue: QUEUE_NAME,
        pidStartedAt: nodeStartedAt,
        lastHeartbeat: new Date(),
        role: 'worker',
        meta: {
          cwd: process.cwd(),
          node: process.version,
          concurrency: 4,
          env: process.env.NODE_ENV ?? 'development',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: workerNodes.id,
        set: {
          lastHeartbeat: new Date(),
          updatedAt: new Date(),
          meta: {
            cwd: process.cwd(),
            node: process.version,
            concurrency: 4,
            env: process.env.NODE_ENV ?? 'development',
          },
        },
      });
    logger.info(`[worker] heartbeat up: ${nodeId}`);
  } catch (e) {
    logger.warn('[worker] heartbeat register failed', e as Error);
  }
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  // 立即注册一次,然后每 10s 续命
  void registerHeartbeat();
  heartbeatTimer = setInterval(() => {
    void registerHeartbeat();
  }, 10_000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

startHeartbeat();
export { nodeId };

