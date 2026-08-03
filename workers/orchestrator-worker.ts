import { Worker } from 'bullmq';
import { orchestrator } from '@/lib/orchestrator/feature-orchestrator';
import { getBullConnection } from '@/lib/redis';

// 队列名必须与 Producer（src/lib/queue/task-queue.ts 的 QUEUE_NAME）一致
// ⚠️ 不能包含冒号（BullMQ 限制：Queue name cannot contain ':'）
// 历史 bug: 曾用 'generation:v2' 导致 Worker 初始化抛错
const QUEUE_NAME = 'ai-tasks';

const worker = new Worker(
  QUEUE_NAME,
  async (job) =>
    orchestrator.execute({
      featureId: job.data.featureId ?? job.data.serviceType,
      userId: job.data.userId,
      inputs: job.data.params ?? job.data.inputs ?? {},
      traceId: String(job.id ?? crypto.randomUUID()),
    }),
  { connection: getBullConnection(), concurrency: 4 }
);

worker.on('failed', (job, error) =>
  console.error(`[worker] ${job?.id} 失败:`, error)
);
worker.on('completed', (job) =>
  console.log(`[worker] ${job.id} 完成`)
);
worker.on('ready', () =>
  console.log(`[worker] 就绪，监听队列: ${QUEUE_NAME}`)
);

// 优雅关闭
async function shutdown() {
  console.log('[worker] 关闭中...');
  await worker.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log(`[worker] orchestrator-worker 启动，队列: ${QUEUE_NAME}`);
