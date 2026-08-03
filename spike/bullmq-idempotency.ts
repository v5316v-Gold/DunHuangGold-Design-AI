/**
 * Spike 4: 幂等性 - 同 jobId 二次添加应失败
 */
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis('redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const queue = new Queue('spike-idem-test', { connection });

async function main() {
  const jobId = `idem-${Date.now()}`;
  
  console.log(`📥 第 1 次添加任务 (jobId=${jobId})...`);
  const job1 = await queue.add('task', { data: 'first' }, { jobId });
  console.log('✅ 第 1 次成功:', job1.id);

  console.log(`📥 第 2 次添加相同 jobId...`);
  try {
    const job2 = await queue.add('task', { data: 'second' }, { jobId });
    console.log('⚠️ 第 2 次成功（不应该）:', job2.id);
  } catch (err: any) {
    console.log('✅ 第 2 次被拒绝（符合预期）:', err.constructor.name);
  }

  console.log('🔍 队列中该 jobId 的任务:');
  const existing = await queue.getJob(jobId);
  console.log('  data:', existing?.data);
  console.log('  attemptsMade:', existing?.attemptsMade);

  console.log('🧹 清理...');
  await queue.drain(true);
  await queue.close();
  await connection.quit();
  console.log('✅ Spike 4 完成');
}

main().catch((err) => {
  console.error('❌ Spike 4 失败:', err);
  process.exit(1);
});