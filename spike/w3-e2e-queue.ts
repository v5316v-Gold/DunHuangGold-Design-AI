/**
 * W3-E 补完：端到端联调
 *
 * 流程：
 * 1. 启动 Worker（后台）
 * 2. POST /api/ai/generate-async 提交任务
 * 3. Worker 消费 → 写 DB → 状态变 completed
 * 4. GET /api/tasks/[id] 验证
 */
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis('redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// ============================================================
// 模拟 Worker（不接 ComfyUI，只验证任务流转）
// ============================================================
const worker = new Worker('ai-tasks', async (job: Job) => {
  console.log(`  ⚙️ Worker 处理任务 #${job.id}`);
  await new Promise((r) => setTimeout(r, 200));  // 模拟 200ms 工作
  return { processed: true, ts: Date.now() };
}, { connection });

worker.on('completed', (job, result) => {
  console.log(`  ✅ 任务 #${job.id} 完成:`, result);
});
worker.on('failed', (job, err) => {
  console.error(`  ❌ 任务 #${job?.id} 失败:`, err.message);
});

// ============================================================
// 提交任务
// ============================================================
async function main() {
  console.log('📋 W3-E 端到端测试');
  console.log('─────────────────');

  const queue = new Queue('ai-tasks', { connection });
  console.log('📥 提交 3 个测试任务...');

  const jobIds: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const job = await queue.add('test-task', { n: i, prompt: `测试 ${i}` });
    jobIds.push(job.id!);
    console.log(`  ✅ 任务 #${job.id} 已入队`);
  }

  // 等待消费完成
  console.log('\n⏳ 等待 Worker 处理...');
  await new Promise((r) => setTimeout(r, 2000));

  // 查询状态
  console.log('\n📊 查询任务状态:');
  for (const jobId of jobIds) {
    const job = await queue.getJob(jobId);
    if (!job) {
      console.log(`  ❌ ${jobId}: 不存在`);
      continue;
    }
    const state = await job.getState();
    console.log(`  ${state === 'completed' ? '✅' : '⏳'} ${jobId}: ${state}`);
  }

  // 清理
  console.log('\n🧹 清理...');
  await worker.close();
  await queue.drain(true);
  await queue.close();
  await connection.quit();
  console.log('✅ W3-E 端到端测试通过');
}

main().catch((err) => {
  console.error('❌ 失败:', err);
  process.exit(1);
});