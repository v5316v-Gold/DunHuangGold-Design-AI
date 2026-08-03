import { Queue } from 'bullmq';
import IORedis from 'ioredis';

async function main() {
  const connection = new IORedis('redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  console.log('🔧 创建测试队列...');
  const queue = new Queue('spike-queue', { connection });

  console.log('📥 添加任务...');
  const job = await queue.add('test-job', { message: 'hello from spike' }, {
    jobId: `spike-${Date.now()}`,
  });
  console.log('✅ 任务已入队:', job.id);

  console.log('🔍 查询队列状态...');
  const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
  console.log('📊 队列状态:', counts);

  console.log('🧹 清理队列...');
  await queue.drain(true);
  await queue.close();
  await connection.quit();
  console.log('✅ Spike 2 完成');
}

main().catch((err) => {
  console.error('❌ Spike 2 失败:', err);
  process.exit(1);
});