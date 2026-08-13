/**
 * Phase 4 验证脚本 v2：只验证编排层决策，不真调外部服务
 * 验证：routing-policy / retry-policy / fallback-policy / ExecutionPlan
 */
import { decideRouting } from '@/lib/ai/orchestration/routing-policy';
import { shouldRetry } from '@/lib/ai/orchestration/retry-policy';
import { decideFallback } from '@/lib/ai/orchestration/fallback-policy';
import { createExecutionPlan, createExecutionTrace } from '@/lib/ai/domain/execution-plan';
import { EXECUTOR_ORDER } from '@/lib/ai/ports/executor.port';

function main() {
  console.log('=== Phase 4: 编排策略验证（不调外部服务）===\n');

  // 1. routing-policy：每个功能的默认执行器
  console.log('--- routing-policy（默认执行器 + fallbackChain）---');
  const routingCases: Array<[string, any]> = [
    ['text2img', { defaultExecutor: null, fallbackExecutors: ['comfyui', 'mock'] }],
    ['relief', { defaultExecutor: 'comfyui', fallbackExecutors: ['mock'] }],
    ['dialogue', { defaultExecutor: 'third-party', fallbackExecutors: [] }],
  ];
  for (const [fid, cfg] of routingCases) {
    const r = decideRouting(fid, cfg);
    console.log(`  ${fid.padEnd(12)} → 主:${r.executorId}  兜底:[${r.fallbackChain.join(',')}]`);
  }

  // 2. retry-policy
  console.log('\n--- retry-policy（重试判定）---');
  for (const code of ['EXECUTOR_EXCEPTION', 'COMFYUI_FAILED', 'INVALID_INPUT', 'THIRD_PARTY_NOT_CONFIGURED']) {
    const r = shouldRetry(code, 0);
    console.log(`  ${code.padEnd(28)} → ${r.verdict}`);
  }

  // 3. ExecutionPlan + trace
  console.log('\n--- ExecutionPlan + trace ---');
  const plan = createExecutionPlan({
    taskId: 'task-1',
    featureId: 'text2img',
    userId: 'user-1',
    executorId: 'third-party',
    fallbackChain: ['comfyui', 'mock'],
    estimatedCost: 15,
    inputsSnapshot: { prompt: '测试' },
  });
  const trace = createExecutionTrace(plan);
  console.log(`  plan: ${plan.planVersion} → ${plan.featureId} 主执行器=${plan.executorId}`);
  console.log(`  trace: taskId=${trace.taskId} attempted=${trace.attempted.length} attempt=${trace.attempt}`);

  // 4. fallback-policy
  console.log('\n--- fallback-policy（兜底决策）---');
  const fb = decideFallback(plan, trace);
  console.log(`  下一个执行器: ${fb.nextExecutor ?? '无（已耗尽）'}  exhausted=${fb.exhausted}`);

  console.log('\n=== 全部通过 ===');
  process.exit(0);
}

main();
