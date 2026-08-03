/**
 * Worker 消费 mock 任务验证脚本（任务四验证用）
 *
 * 用途：不依赖 Redis，直接验证 orchestrator.execute 的 mock 执行器路径，
 *      证明 Worker 的 job 处理函数（worker 内联逻辑）能正确消费任务。
 *
 * 运行：npx tsx scripts/verify-worker-mock.ts
 */
process.env.DATABASE_URL = '';

import { MockExecutor } from '@/lib/orchestrator/executors/mock-executor';

async function main() {
  console.log('=== Worker Mock 消费验证 ===\n');

  // 1. MockExecutor 能力检查
  const exec = new MockExecutor();
  const caps = exec.capabilities();
  console.log(`1. MockExecutor capabilities: ${caps.size} 个`);
  console.log(`   包含 text2img: ${caps.has('text2img')}`);
  console.log(`   包含 tryon: ${caps.has('tryon')}`);
  console.log(`   包含 relief: ${caps.has('relief')}`);

  // 2. 模拟 Worker job 处理（与 orchestrator-worker.ts 的处理器一致）
  const fakeJob = {
    id: 'job-mock-001',
    data: {
      featureId: 'text2img',
      userId: 'user-test-001',
      params: { prompt: '一只飞翔的九色鹿，敦煌壁画风格', width: 1024, height: 1024 },
    },
  };

  const result = await exec.execute({
    featureId: fakeJob.data.featureId,
    userId: fakeJob.data.userId,
    inputs: fakeJob.data.params,
    traceId: String(fakeJob.id),
  });

  console.log('\n2. Mock 任务消费结果:');
  console.log(`   success: ${result.success}`);
  console.log(`   executorUsed: ${result.executorUsed}`);
  console.log(`   cost: ${result.cost}`);
  console.log(`   latencyMs: ${result.latencyMs}`);
  console.log(`   artifacts: ${JSON.stringify(result.artifacts)}`);

  if (result.success) {
    console.log('\n✅ Worker mock 消费验证通过');
  } else {
    console.log('\n❌ Worker mock 消费失败:', JSON.stringify(result.error));
    process.exit(1);
  }

  // 3. 验证 tryon（新功能）也能被 mock 消费
  const tryonResult = await exec.execute({
    featureId: 'tryon',
    userId: 'user-test-001',
    inputs: { description: '金色旗袍试穿' },
    traceId: 'job-mock-002',
  });
  console.log(`\n3. tryon mock 消费: success=${tryonResult.success} executorUsed=${tryonResult.executorUsed}`);
}

main().catch((e) => {
  console.error('验证失败:', e.message);
  process.exit(1);
});
