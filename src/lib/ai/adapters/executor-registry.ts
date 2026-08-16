/**
 * Phase 4.6 · Executor 注册（旧 executor → 新 Port 适配）
 *
 * 把现有 executor 注册到新 PolicyOrchestrator：
 *   - ComfyUIExecutor    → 16 设计类（主执行器）
 *   - HermesAgentExecutor → AI 对话（主执行器）
 *   - MinimaxExecutor    → Cloud fallback（仅 5 真支持功能）
 *   - MockExecutor       → 仅开发/测试环境（ADR-010：production 禁 mock）
 *
 * Phase 9.23 · Workflow Asset Closure 收口变更：
 *   - 增加 hermes 类型
 *   - Minimax 收窄 capabilities 为 5 真支持（fallback 专用）
 */

import { MockExecutor } from '@/lib/orchestrator/executors/mock-executor';
import { ComfyUIExecutor } from '@/lib/orchestrator/executors/comfyui-executor';
import { MinimaxExecutor } from '@/lib/orchestrator/executors/minimax-executor';
import { HermesAgentExecutor } from '@/lib/orchestrator/executors/hermes-agent-executor';
import { policyOrchestrator } from '@/lib/ai/orchestration/policy-orchestrator';
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
    // 归一化执行器 id：本地执行器用 -local 后缀，路由决策（routing-policy）用短 id。
    // 若不归一化，Map.get('comfyui'/'hermes') 会永远失配 → 本地执行器被跳过、只能走云 fallback。
    const NORMALIZED_IDS: Record<string, ExecutorType> = {
      'mock-local': 'mock',
      'comfyui-local': 'comfyui',
      'hermes-agent-local': 'hermes',
    };
    this.id = NORMALIZED_IDS[inner.id] ?? (inner.id as ExecutorType);
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

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ALLOW_MOCK_IN_PRODUCTION = process.env.ALLOW_MOCK_IN_PRODUCTION === 'true';

let initialized = false;
export function registerExecutors(): void {
  if (initialized) return;

  // ADR-010：production 禁 mock（除非显式开启 ALLOW_MOCK_IN_PRODUCTION 用于灰度）
  if (!IS_PRODUCTION || ALLOW_MOCK_IN_PRODUCTION) {
    policyOrchestrator.register(new IdNormalizedExecutor(new MockExecutor()));
    if (IS_PRODUCTION && ALLOW_MOCK_IN_PRODUCTION) {
      console.warn('[executor-registry] ⚠️ ALLOW_MOCK_IN_PRODUCTION=true,已在生产注册 MockExecutor（仅灰度用）');
    }
  } else {
    console.warn('[executor-registry] NODE_ENV=production: MockExecutor 未注册（ADR-010 禁止 mock 成功）');
  }

  // 主执行器 1：ComfyUIExecutor（16 设计类）
  policyOrchestrator.register(new IdNormalizedExecutor(new ComfyUIExecutor()));

  // 主执行器 2：HermesAgentExecutor（AI 对话）
  policyOrchestrator.register(new IdNormalizedExecutor(new HermesAgentExecutor()));

  // Cloud fallback：MinimaxExecutor（5 真支持功能）
  policyOrchestrator.register(new IdNormalizedExecutor(new MinimaxExecutor()));

  initialized = true;
}

registerExecutors();