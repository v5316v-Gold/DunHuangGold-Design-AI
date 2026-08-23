/**
 * HermesAgentExecutor（Phase 9.23 · Workflow Asset Closure）
 *
 * 主执行器：AI 对话（dialogue）
 * 底层：本机 Hermes CLI（hermes chat --resume <session_id>）
 * 失败兜底：MinimaxExecutor（CloudExecutor 收编）
 *
 * 约束：
 *  - 仅处理 dialogue 类功能（capabilities 收敛）
 *  - 用户入参仅含 message + conversationId（多轮续聊）
 *  - 失败码 HERMES_UNAVAILABLE/HERMES_TIMEOUT/HERMES_FAILED 全部 retryable=true
 *    便于 orchestrator 路由 fallback 至 third-party（Minimax）
 */
import type { Executor } from '@/lib/ai/ports/executor.port';
import type { FeatureExecutionRequest, FeatureExecutionResult } from '../types';
import { spawn } from 'child_process';
import { callHermesAgent, HermesAgentError } from '@/lib/hermes-agent';

// AI 对话功能（仅 1 个）
export const HERMES_CHAT_FEATURES = new Set<string>(['dialogue']);

export class HermesAgentExecutor implements Executor {
  readonly type = 'hermes' as const;
  readonly id = 'hermes';
  readonly productionSafe = true;

  capabilities(): Set<string> {
    return HERMES_CHAT_FEATURES;
  }

  async isAvailable(): Promise<boolean> {
    // W1·R2·feature flag: DIALOGUE_RUNTIME=cloud 让对话直接走 Minimax,
    //   避免部署时缺 hermes CLI 导致对话全挂。
    if ((process.env.DIALOGUE_RUNTIME || '').toLowerCase() === 'cloud') {
      return false;
    }
    // 简单健康检查：尝试 spawn hermes --version，失败不可用
    return new Promise((resolve) => {
      try {
        const p = spawn('hermes', ['--version'], { shell: false, windowsHide: true });
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            p.kill();
            resolve(false);
          }
        }, 2000);
        p.on('close', (code: number | null) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          resolve(code === 0);
        });
        p.on('error', () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timer);
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  }

  async execute(req: FeatureExecutionRequest): Promise<FeatureExecutionResult> {
    const started = Date.now();

    // 二次拦截：非 dialogue → 立即失败（路由兜底）
    if (!HERMES_CHAT_FEATURES.has(req.featureId)) {
      return {
        success: false,
        executorUsed: this.type,
        provider: this.id,
        error: {
          code: 'FEATURE_NOT_SUPPORTED',
          message: `HermesAgentExecutor 不支持功能 ${req.featureId}（仅 dialogue）`,
          retryable: false,
        },
        cost: 0,
        latencyMs: Date.now() - started,
        traceId: req.traceId,
      };
    }

    // 入参提取：兼容多种字段名
    const inputs = (req.inputs as Record<string, unknown>) || {};
    const message = String(inputs.message ?? inputs.prompt ?? '');
    const resumeSessionId = inputs.conversationId
      ? String(inputs.conversationId)
      : (inputs.sessionId ? String(inputs.sessionId) : undefined);

    if (!message) {
      return {
        success: false,
        executorUsed: this.type,
        provider: this.id,
        error: {
          code: 'INVALID_INPUT',
          message: 'Hermes Agent 需要 message 字段',
          retryable: false,
        },
        cost: 0,
        latencyMs: Date.now() - started,
        traceId: req.traceId,
      };
    }

    try {
      const result = await callHermesAgent({ message, resumeSessionId });
      // 成功：reply 作为 artifact text 返回；sessionId 作为 metadata 透传
      return {
        success: true,
        executorUsed: this.type,
        provider: this.id,
        artifacts: [
          {
            url: `hermes://${result.sessionId || 'session'}`,
            mime: 'text/plain',
            metadata: {
              reply: result.reply,
              sessionId: result.sessionId,
            },
          },
        ],
        cost: 0,
        latencyMs: Date.now() - started,
        traceId: req.traceId,
      };
    } catch (err) {
      const isHermesErr = err instanceof HermesAgentError;
      return {
        success: false,
        executorUsed: this.type,
        provider: this.id,
        error: {
          code: isHermesErr ? err.code : 'HERMES_FAILED',
          message: isHermesErr ? err.message : String((err as Error).message ?? err),
          retryable: isHermesErr ? err.retryable : true,
        },
        cost: 0,
        latencyMs: Date.now() - started,
        traceId: req.traceId,
      };
    }
  }
}