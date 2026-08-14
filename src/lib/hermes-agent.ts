/**
 * Hermes CLI 封装（Phase 9.23 · AI 对话统一执行器）
 *
 * 设计原则：
 *  - 命令参数数组化，禁止 shell 拼接防注入
 *  - 输出格式：hermes chat -q "<msg>" -Q → stdout 第一行 session_id，随后为回复
 *  - 异步返回 { sessionId, reply }
 *  - 单条消息上限 4000 字符（与原 /api/chat handleHermesChat 一致）
 *  - 失败抛出 HERMES_UNAVAILABLE（路由兜底可降级 Minimax）
 */
import { spawn } from 'child_process';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('hermes-agent');

export interface HermesCallInput {
  message: string;
  resumeSessionId?: string;
  /** 单条消息最大字符数（默认 4000） */
  maxLength?: number;
}

export interface HermesCallResult {
  sessionId: string;
  reply: string;
  /** 调用耗时（ms） */
  latencyMs: number;
}

export class HermesAgentError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, message: string, retryable = true) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

const DEFAULT_MAX = 4000;
const HARD_TIMEOUT_MS = 60_000;

/**
 * 调用 Hermes Agent（本机 CLI）
 *
 * @throws HermesAgentError 失败可被 orchestrator 路由兜底到 CloudExecutor（minimax）
 */
export function callHermesAgent(input: HermesCallInput): Promise<HermesCallResult> {
  return new Promise((resolve, reject) => {
    const max = input.maxLength ?? DEFAULT_MAX;
    if (input.message.length > max) {
      return reject(new HermesAgentError(
        'MESSAGE_TOO_LONG',
        `消息过长（上限 ${max} 字符）`,
        false,
      ));
    }

    const args = ['chat', '-q', input.message, '-Q'];
    if (input.resumeSessionId) {
      args.push('--resume', input.resumeSessionId);
    }

    const started = Date.now();
    const child = spawn('hermes', args, {
      windowsHide: true,
      env: { ...process.env, NO_COLOR: '1', HERMES_NONINTERACTIVE: '1' },
      shell: false,
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      reject(new HermesAgentError(
        'HERMES_TIMEOUT',
        `Hermes 调用超时（${HARD_TIMEOUT_MS}ms）`,
        true,
      ));
    }, HARD_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (killed) return;
      // 通常是 PATH 中没有 hermes（spawn ENOENT）
      logger.warn('Hermes CLI 不可用，可降级 Minimax', { err: err.message });
      reject(new HermesAgentError(
        'HERMES_UNAVAILABLE',
        `Hermes CLI 调用失败：${err.message}`,
        true,
      ));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killed) return;
      if (code !== 0) {
        logger.error('Hermes CLI 退出非零', { code, stderr });
        return reject(new HermesAgentError(
          'HERMES_FAILED',
          `Hermes CLI 退出码 ${code}：${stderr.slice(0, 200) || '未知错误'}`,
          true,
        ));
      }

      // 解析 stdout：第一行 session_id（数字_数字_十六进制），其后为回复
      // 容错：可能没有 session_id 行（hermes --help 模式等）
      const lines = stdout.split(/\r?\n/);
      let sessionId = '';
      let reply = '';
      const sessionIdPattern = /^\d{8}_\d{6}_[0-9a-f]+$/i;
      const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0);
      if (firstNonEmpty >= 0 && sessionIdPattern.test(lines[firstNonEmpty].trim())) {
        sessionId = lines[firstNonEmpty].trim();
        reply = lines.slice(firstNonEmpty + 1).join('\n').trim();
      } else {
        reply = stdout.trim();
      }

      if (!reply) {
        return reject(new HermesAgentError(
          'HERMES_EMPTY_RESPONSE',
          'Hermes 返回内容为空',
          true,
        ));
      }

      resolve({
        sessionId,
        reply,
        latencyMs: Date.now() - started,
      });
    });
  });
}