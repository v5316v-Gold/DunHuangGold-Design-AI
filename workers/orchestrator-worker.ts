import { Worker } from 'bullmq';
// Phase 4：worker 走新 PolicyOrchestrator（策略驱动：routing/retry/fallback + ExecutionPlan）
// 旧 orchestrator（src/lib/orchestrator/feature-orchestrator）已冻结 deprecated
import { policyOrchestrator } from '@/lib/ai/orchestration/policy-orchestrator';
import { getBullConnection } from '@/lib/redis';
import {
  markProcessing,
  markCompleted,
  markFailed,
  markDeadLetter,
} from '@/lib/queue/task-state';
import { createLogger } from '@/lib/error-handler';
import { db } from '@/db';
import { works } from '@/db/schema';

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
  });
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
    const result = await policyOrchestrator.execute({
      featureId,
      userId,
      inputs: params,
      traceId,
    });

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
    throw new Error(errorMessage);
  },
  { connection: getBullConnection(), concurrency: 4 }
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
  await worker.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

logger.info(`[worker] orchestrator-worker 启动，队列: ${QUEUE_NAME}`);
