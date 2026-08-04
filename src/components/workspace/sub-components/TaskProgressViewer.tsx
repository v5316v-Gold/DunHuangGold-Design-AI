/**
 * Phase 7.2 · TaskProgressViewer — 统一任务进度查看器
 *
 * 供所有 AI 功能组件复用（与 useTaskPolling 搭配）。
 * 展示：任务状态 / 进度条 / 错误 / 结果 / 取消 / 重试。
 */

'use client';

import type { TaskPollState } from '@/hooks/useTaskPolling';

interface TaskProgressViewerProps {
  state: TaskPollState;
  onCancel?: () => void;
  onRetry?: () => void;
  compact?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  idle: '待提交',
  submitting: '提交中...',
  pending: '排队中',
  processing: '生成中...',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
  dead_letter: '已放弃（多次失败）',
  error: '出错',
};

export function TaskProgressViewer({
  state,
  onCancel,
  onRetry,
  compact = false,
}: TaskProgressViewerProps) {
  const active =
    state.status === 'submitting' ||
    state.status === 'pending' ||
    state.status === 'processing';

  if (state.status === 'idle') return null;

  return (
    <div className="mt-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/50 p-4">
      {/* 状态行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {active && (
            <div className="w-3.5 h-3.5 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
          )}
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {STATUS_LABEL[state.status] ?? state.status}
          </span>
          {state.taskId && (
            <span className="text-[10px] text-[var(--text-dim)] font-mono truncate max-w-[160px]">
              {state.taskId.slice(0, 16)}
            </span>
          )}
        </div>

        {/* 操作按钮 */}
        {(state.status === 'pending' || state.status === 'processing') && onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-[var(--text-dim)] hover:text-[var(--danger)] transition-colors"
          >
            取消
          </button>
        )}
        {(state.status === 'failed' || state.status === 'dead_letter') && onRetry && (
          <button
            onClick={onRetry}
            className="text-xs px-2 py-1 rounded-lg bg-[var(--gold-muted)] text-[var(--gold)] hover:bg-[var(--gold-muted)]/70 transition-colors"
          >
            重试
          </button>
        )}
      </div>

      {/* 进度条 */}
      {state.status === 'processing' && !compact && (
        <div className="mt-3 h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] transition-all duration-500"
            style={{ width: `${Math.max(5, state.progress)}%` }}
          />
        </div>
      )}

      {/* 错误信息 */}
      {state.error && (
        <p className="mt-2 text-xs text-[var(--danger)]">{state.error}</p>
      )}

      {/* 消息 */}
      {state.message && !state.error && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">{state.message}</p>
      )}

      {/* 结果（图片/视频） */}
      {state.status === 'completed' && state.output && !compact && (
        <div className="mt-3">
          {typeof state.output === 'object' && (
            <ResultPreview output={state.output as Record<string, unknown>} />
          )}
        </div>
      )}
    </div>
  );
}

/** 结果预览（支持 urls / url / images 数组） */
function ResultPreview({ output }: { output: Record<string, unknown> }) {
  const urls: string[] = [];
  const candidates = [output.urls, output.url, output.images, output.image];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      urls.push(...c.filter((x): x is string => typeof x === 'string'));
    } else if (typeof c === 'string') {
      urls.push(c);
    }
  }
  if (urls.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {urls.slice(0, 4).map((url, i) => (
        <img
          key={i}
          src={url}
          alt={`生成结果 ${i + 1}`}
          className="w-full rounded-lg border border-[var(--border-color)] object-cover"
          loading="lazy"
        />
      ))}
    </div>
  );
}
