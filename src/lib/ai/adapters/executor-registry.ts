/**
 * Phase 4.6 · Executor 注册（旧 executor → 新 Port 适配）
 *
 * 把现有 3 个 executor（mock/comfyui/third-party）注册到新 PolicyOrchestrator。
 * 目标：新编排器可直接用同一套执行器，无需重写（增量迁移，约束：不重写 17 功能）。
 *
 * Phase 9.22 加固：生产环境（NODE_ENV=production）不注册 MockExecutor
 * （ADR-010：mock 仅非生产，production 严禁 mock 成功冒充生产）。
 */

import { MockExecutor } from '@/lib/orchestrator/executors/mock-executor';
import { ComfyUIExecutor } from '@/lib/orchestrator/executors/comfyui-executor';
import { MinimaxExecutor } from '@/lib/orchestrator/executors/minimax-executor';
import { policyOrchestrator } from '@/lib/ai/orchestration/policy-orchestrator';

// 旧 executor 的 id 是 'mock-local' / 'comfyui' / 'third-party'，
// 新 Port 期望 id 为 ExecutorType（mock/comfyui/third-party）。
// 这里做一次 id 归一化包装。
import type { Executor, ExecutorType, ExecutorRequest, ExecutorResult } from '@/lib/ai/ports/executor.port';

class IdNormalizedExecutor implements Executor {
  readonly id: ExecutorType;
  readonly productionSafe: boolean;
  private inner: {
    readonly type: string;
    readonly id: string;
    capabilities(): Set<string>;
    execute(req: unknown): Promise<ExecutorResult>;
  };

  constructor(inner: {
    readonly type: string;
    readonly id: string;
    capabilities(): Set<string>;
    execute(req: unknown): Promise<ExecutorResult>;
  }) {
    this.inner = inner;
    // 旧 id 'mock-local' → 'mock'；其余直接映射
    this.id = (inner.id === 'mock-local' ? 'mock' : inner.id) as ExecutorType;
    this.productionSafe = this.id !== 'mock';
  }

  capabilities(): Set<string> {
    return this.inner.capabilities();
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async execute(req: ExecutorRequest): Promise<ExecutorResult> {
    return this.inner.execute(req as never);
  }
}

/** 是否生产环境（G2：production 严禁 mock） */
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** 初始化并注册全部执行器（幂等：重复调用安全） */
let initialized = false;
export function registerExecutors(): void {
  if (initialized) return;

  // G2 加固: production 不注册 mock（ADR-010）
  if (!IS_PRODUCTION) {
    policyOrchestrator.register(new IdNormalizedExecutor(new MockExecutor()));
  } else {
    console.warn('[executor-registry] NODE_ENV=production: MockExecutor 未注册（ADR-010 禁止 mock 成功）');
  }

  policyOrchestrator.register(new IdNormalizedExecutor(new ComfyUIExecutor()));

  // Phase 9.20: MinimaxExecutor 替代占位的 ThirdPartyExecutor
  policyOrchestrator.register(new IdNormalizedExecutor(new MinimaxExecutor()));
  initialized = true;
}

// 副作用注册（模块加载即生效，消费方无需手动调用）
registerExecutors();
