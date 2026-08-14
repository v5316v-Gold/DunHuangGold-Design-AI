/**
 * Worker 进程入口
 *
 * 职责：
 * 1. 启动 BullMQ Worker 监听 ai-tasks 队列
 * 2. 处理每个任务：更新状态 → 调 AI Adapter → 保存结果
 * 3. 错误处理：失败重试 → 死信告警
 *
 * 部署：
 * - PM2 进程名: dunhuang-worker
 * - 启动命令: node worker/dist/index.js (或 tsx 直接跑)
 * - 优雅退出: SIGTERM 时等待当前任务完成
 */

import { Worker, type Job } from 'bullmq';
import { getBullConnection } from '@/lib/redis';
import {
  markProcessing,
  updateProgress,
  markCompleted,
  markFailed,
  markDeadLetter,
} from '@/lib/queue/task-state';
// Phase 9.24: ai-service/services 已删除（死代码）；改走 PolicyOrchestrator 主链路
import { policyOrchestrator } from '@/lib/ai/orchestration/policy-orchestrator';
import { db } from '@/storage/database/db';
import { works } from '@/storage/database/shared/schema';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('worker');

const QUEUE_NAME = 'ai-tasks';

// ============================================================
// AI 任务处理器
// ============================================================

interface JobData {
  taskId: string;
  userId: string;
  serviceType: string;
  params: Record<string, unknown>;
}

/**
 * 处理单个 AI 任务
 */
async function processJob(job: Job<JobData>): Promise<unknown> {
  const { taskId, userId, serviceType, params } = job.data;
  const attempt = (job.attemptsMade ?? 0) + 1;

  logger.info(`处理任务 ${taskId} (${serviceType}) - attempt ${attempt}`);

  try {
    // 1. 标记 processing
    await markProcessing(taskId, attempt);

    // 2. 通过 PolicyOrchestrator 执行（主链路 — features.default_executor 路由）
    //    Phase 9.24 改写：原 ai-service registry 已删除，policyOrchestrator 接收
    //    featureId(userId=... & inputs=...) 的统一调用契约。
    const execResult = await policyOrchestrator.execute({
      featureId: serviceType,
      userId,
      inputs: params,
      traceId: taskId,
    });
    const result = {
      success: execResult.success,
      artifacts: execResult.artifacts?.map(a => ({
        url: a.url,
        mime: a.mime,
        metadata: a.metadata,
      })),
      error: execResult.error,
    };

    // 5. 进度上报：80%
    await updateProgress(taskId, 80);

    if (!result.success) {
      const msg = result.error?.message || (typeof result.error === 'string' ? result.error : 'AI 生成失败');
      throw new Error(msg);
    }

    // 6. 保存作品记录（如果有结果数据）
    const imageUrls = result.artifacts?.map(a => a.url).filter(Boolean) ?? [];
    if (db && imageUrls.length > 0) {
      try {
        await db.insert(works).values({
          userId,
          title: extractTitle(params),
          type: serviceType,
          prompt: (params.prompt as string) || null,
          outputImageUrl: imageUrls[0] || null,
          params,
          powerCost: 0, // Phase 9.24: 由 PowerLedger 统一管理
          status: 'completed',
          isPublic: false,
        });
      } catch (dbErr) {
        logger.warn(`保存作品记录失败（不阻塞任务）: ${taskId}`, dbErr);
      }
    }

    // 7. 标记完成
    await markCompleted(taskId, {
      images: imageUrls,
      provider: '',
      workflow: '',
      powerCost: 0,
    });

    return {
      success: true,
      taskId,
      data: imageUrls,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const maxAttempts = job.opts.attempts ?? 3;

    if (attempt >= maxAttempts) {
      // 死信
      await markDeadLetter(taskId, errMsg);
      await sendDeadLetterAlert(taskId, serviceType, errMsg);
      // 不抛错（BullMQ 不会重试）
      return { success: false, deadLetter: true, error: errMsg };
    }

    // 标记失败（让 BullMQ 重试）
    await markFailed(taskId, errMsg, attempt);
    throw error;  // 触发 BullMQ 重试
  }
}

/**
 * 从参数中提取标题
 */
function extractTitle(params: Record<string, unknown>): string {
  const prompt = params.prompt as string | undefined;
  if (prompt) return prompt.substring(0, 100);
  return '未命名作品';
}

/**
 * 死信告警（占位实现，后续接入飞书）
 */
async function sendDeadLetterAlert(
  taskId: string,
  serviceType: string,
  error: string
): Promise<void> {
  logger.error(`🚨 死信告警: task=${taskId} service=${serviceType} error=${error}`);
  // TODO: 接入飞书 webhook
}

// ============================================================
// Worker 启动
// ============================================================

function startWorker(): Worker<JobData> {
  const worker = new Worker<JobData>(
    QUEUE_NAME,
    processJob,
    {
      connection: getBullConnection(),
      concurrency: 2,           // 单 Worker 并发 2 个任务
      limiter: {
        max: 10,
        duration: 60_000,       // 每分钟最多 10 个任务
      },
      stalledInterval: 30_000,  // 30s 检查一次 stalled
      maxStalledCount: 2,        // 最多 stall 2 次
    }
  );

  worker.on('ready', () => {
    logger.info(`Worker ready, listening on queue: ${QUEUE_NAME}`);
  });

  worker.on('completed', (job, result) => {
    logger.info(`任务完成: ${job.id} (${job.data.serviceType})`);
  });

  worker.on('failed', (job, err) => {
    const taskId = job?.data?.taskId ?? 'unknown';
    logger.warn(`任务失败: ${taskId} attempt=${job?.attemptsMade}: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(`Worker error: ${err.message}`);
  });

  worker.on('stalled', (jobId) => {
    logger.warn(`任务 stalled: ${jobId}`);
  });

  return worker;
}

// ============================================================
// 优雅退出
// ============================================================

let _worker: Worker<JobData> | null = null;

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`收到 ${signal}，开始优雅退出...`);
  if (_worker) {
    await _worker.close();
    logger.info('Worker 已关闭');
  }
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================================
// 启动
// ============================================================

// 注册所有 AI 服务（自动 side-effect）
import '@/lib/ai-service/services';

logger.info('启动 Worker 进程...');
_worker = startWorker();