/**
 * Spike 3: 端到端 Producer → Worker 流程
 * 启动一个 Worker 消费 5s，处理 3 个任务
 */
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis('redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const queue = new Queue<{ n: number }>('spike-worker-test', { connection });

async function producer() {
  console.log('📥 Producer: 添加 3 个任务...');
  for (let i = 1; i <= 3; i++) {
    await queue.add('task', { n: i });
  }
  console.log('✅ 已入队 3 个任务');
}

async function worker() {
  console.log('⚙️ Worker: 启动...');
  const w = new Worker<{ n: number }>(
    'spike-worker-test',
    async (job: Job<{ n: number }>) => {
      console.log(`  → Worker 处理任务 #${job.data.n} (jobId=${job.id})`);
      await new Promise((r) => setTimeout(r, 500));  // 模拟 0.5s 工作
      return { result: `processed ${job.data.n}` };
    },
    { connection }
  );

  w.on('completed', (job, result) => {
    console.log(`  ✅ 任务 #${job.data.n} 完成: ${JSON.stringify(result)}`);
  });
  w.on('failed', (job, err) => {
    console.error(`  ❌ 任务 #${job?.data?.n} 失败:`, err.message);
  });

  return w;
}

async function main() {
  await producer();
  const w = await worker();

  // 等待所有任务完成
  await new Promise((r) => setTimeout(r, 5000));

  console.log('🧹 关闭 worker 和清理...');
  await w.close();
  await queue.drain(true);
  await queue.close();
  await connection.quit();
  console.log('✅ Spike 3 完成');
}

main().catch((err) => {
  console.error('❌ Spike 3 失败:', err);
  process.exit(1);
});