'use client';

/**
 * 系统健康面板 (Admin)
 *
 * 路径: /admin/system
 *
 * 职责:
 *   - 每 30 秒轮询 GET /api/admin/system 获取健康报告
 *   - 顶部状态条: 聚合状态(ok=绿 / degraded=琥珀) + 更新时间 + 手动刷新
 *   - 卡片网格展示每个检查项: postgres / redis / workers / comfyui / storage / thirdParty
 *   - workers 卡片额外显示在线数; comfyui 卡片额外显示队列长度 + GPU 显存百分比条
 *
 * 样式: 敦煌金主题（深色卡片 --bg-card / --bg-secondary，金色点缀 --gold）
 * 状态色: ok=--success 绿 / degraded=--warning 琥珀 / down=--error 红 / unknown=--text-muted 灰
 * 鉴权: 由 src/middleware.ts 统一拦截 /admin/*，API 层另有 requireAdmin 双保险
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  Database,
  Cpu,
  HardDrive,
  Cloud,
  Image as ImageIcon,
  Server,
  Clock,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { getAuthHeader } from '@/hooks/useAuth';

// ==================== 类型定义（与 system-health.ts 对齐） ====================

type CheckStatus = 'ok' | 'degraded' | 'down' | 'unknown';

interface SystemCheckResult {
  status: CheckStatus;
  latencyMs?: number;
  detail?: string;
  /** 附加数据（如 GPU 显存、队列长度） */
  data?: Record<string, unknown>;
  checkedAt: string;
}

interface SystemHealthReport {
  status: CheckStatus; // 聚合状态
  timestamp: string;
  uptime: number;
  version: string;
  checks: Record<string, SystemCheckResult>;
}

// ==================== 静态元数据 ====================

const REFRESH_INTERVAL_MS = 30_000; // 30 秒自动刷新

const CHECK_META: Record<
  string,
  { label: string; icon: typeof Database; description: string }
> = {
  postgres: { label: 'PostgreSQL 数据库', icon: Database, description: '数据库连通性' },
  redis: { label: 'Redis 缓存', icon: Server, description: '缓存 / 任务队列连接' },
  workers: { label: '任务 Workers', icon: Cpu, description: 'BullMQ Worker 在线数' },
  comfyui: { label: 'ComfyUI 生图服务', icon: ImageIcon, description: '服务状态 / 队列 / GPU' },
  storage: { label: '对象存储', icon: HardDrive, description: 'S3 / R2 / 本地存储读写' },
  thirdParty: { label: '第三方 API', icon: Cloud, description: '智谱 / 豆包 / OpenAI 等' },
};

const STATUS_META: Record<
  CheckStatus,
  { label: string; text: string; badge: string; dot: string }
> = {
  ok: {
    label: '正常',
    text: 'text-[var(--success)]',
    badge: 'bg-[var(--success-light)] border-[rgba(74,154,122,0.35)] text-[var(--success)]',
    dot: 'bg-[var(--success)]',
  },
  degraded: {
    label: '降级',
    text: 'text-[var(--warning)]',
    badge: 'bg-[var(--warning-light)] border-[rgba(196,154,58,0.35)] text-[var(--warning)]',
    dot: 'bg-[var(--warning)]',
  },
  down: {
    label: '不可用',
    text: 'text-[var(--error)]',
    badge: 'bg-[var(--error-light)] border-[rgba(184,84,80,0.35)] text-[var(--error)]',
    dot: 'bg-[var(--error)]',
  },
  unknown: {
    label: '未知',
    text: 'text-[var(--text-muted)]',
    badge: 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-muted)]',
    dot: 'bg-[var(--text-muted)]',
  },
};

// ==================== 工具函数 ====================

/** 秒 → "X小时 Y分" 可读格式 */
function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}小时 ${m}分`;
  if (m > 0) return `${m}分 ${s}秒`;
  return `${s}秒`;
}

/** 毫秒 → 可读延迟 */
function formatLatency(ms?: number): string {
  return ms === undefined || ms === null ? '—' : `${ms} ms`;
}

// ==================== 页面组件 ====================

export default function SystemHealthPage() {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch('/api/admin/system', {
        headers: getAuthHeader(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `请求失败 (HTTP ${res.status})`);
      }
      setReport(data.data as SystemHealthReport);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : '健康检查请求失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 首次加载 + 每 30 秒自动刷新（卸载时清理）
  useEffect(() => {
    loadData(false);
    const timer = setInterval(() => loadData(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadData]);

  const aggregateMeta = report
    ? STATUS_META[report.status]
    : STATUS_META.unknown;

  return (
    <div className="p-6 min-h-screen bg-[var(--bg-primary)]">
      {/* ===== 顶部状态条 ===== */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Activity className="w-6 h-6 text-[var(--gold)]" />
            系统健康
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            自动每 30 秒刷新 · 探测 postgres / redis / workers / comfyui / storage / thirdParty
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
              <Clock className="w-4 h-4" />
              更新于 {lastUpdated.toLocaleTimeString('zh-CN')}
            </div>
          )}

          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-medium ${
              report && report.status === 'ok'
                ? 'border-[rgba(74,154,122,0.4)] bg-[var(--success-light)] text-[var(--success)] shadow-[0_0_16px_rgba(74,154,122,0.25)]'
                : 'border-[rgba(196,154,58,0.5)] bg-[var(--warning-light)] text-[var(--warning)] shadow-[0_0_16px_rgba(196,154,58,0.3)]'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                report && report.status === 'ok'
                  ? 'bg-[var(--success)]'
                  : 'bg-[var(--warning)]'
              }`}
            />
            {report ? `聚合状态: ${aggregateMeta.label}` : '检测中…'}
          </div>

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--gold-border)] text-[var(--gold)] text-sm font-medium hover:bg-[var(--bg-hover)] hover:shadow-[0_0_12px_rgba(212,175,55,0.25)] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {/* ===== 错误提示 ===== */}
      {error && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-lg border border-[rgba(184,84,80,0.4)] bg-[var(--error-light)] text-[var(--error)] text-sm">
          <XCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ===== 加载中 ===== */}
      {loading && !report ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-[var(--gold)]" />
          <p className="text-sm text-[var(--text-muted)]">
            正在执行健康检查（约 3-5 秒）…
          </p>
        </div>
      ) : (
        <>
          {/* ===== 概要信息 ===== */}
          {report && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <SummaryCard label="聚合状态" value={aggregateMeta.label} valueClass={aggregateMeta.text} />
              <SummaryCard label="检查项" value={`${Object.keys(report.checks).length} 项`} />
              <SummaryCard label="运行时长" value={formatUptime(report.uptime)} />
              <SummaryCard label="版本" value={report.version || '—'} />
            </div>
          )}

          {/* ===== 检查项卡片网格 ===== */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {report &&
              Object.entries(report.checks).map(([key, check]) => {
                const meta = CHECK_META[key] || {
                  label: key,
                  icon: Server,
                  description: '',
                };
                const Icon = meta.icon;
                const status = STATUS_META[check.status];
                return (
                  <div
                    key={key}
                    className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-5 hover:border-[var(--gold-border)] transition-all"
                  >
                    {/* 卡片头 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--gold-muted)] flex items-center justify-center">
                          <Icon className="w-5 h-5 text-[var(--gold)]" />
                        </div>
                        <div>
                          <h3 className="font-medium text-[var(--text-primary)]">
                            {meta.label}
                          </h3>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5">
                            {meta.description}
                          </p>
                        </div>
                      </div>
                      {/* 状态徽章 */}
                      <span
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${status.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </div>

                    {/* 延迟 */}
                    <div className="flex items-center gap-2 text-sm mb-3">
                      <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                      <span className="text-[var(--text-muted)]">延迟</span>
                      <span className="font-mono text-[var(--text-primary)]">
                        {formatLatency(check.latencyMs)}
                      </span>
                    </div>

                    {/* 详情 / 附加数据 */}
                    <div className="text-sm text-[var(--text-secondary)] space-y-2">
                      {check.detail && (
                        <p className="break-all text-[var(--text-muted)]">
                          {check.detail}
                        </p>
                      )}

                      {/* workers: 在线数 */}
                      {key === 'workers' && (
                        <div className="flex items-center gap-2">
                          <Cpu className="w-4 h-4 text-[var(--gold)]" />
                          <span>
                            在线 Worker:{' '}
                            <span className="font-bold text-[var(--text-primary)]">
                              {Number(check.data?.online ?? 0)}
                            </span>{' '}
                            个
                          </span>
                        </div>
                      )}

                      {/* comfyui: 队列 + GPU 显存 */}
                      {key === 'comfyui' && (
                        <ComfyUIDetails check={check} />
                      )}

                      {/* thirdParty: Provider 列表 */}
                      {key === 'thirdParty' && Array.isArray(check.data?.providers) && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(check.data!.providers as string[]).map((p) => (
                            <span
                              key={p}
                              className="px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)]"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

// ==================== 子组件 ====================

/** 概要信息小卡 */
function SummaryCard({
  label,
  value,
  valueClass = 'text-[var(--text-primary)]',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] px-4 py-3">
      <div className={`text-xl font-bold ${valueClass}`}>{value}</div>
      <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
    </div>
  );
}

/** ComfyUI 专属详情：队列长度 + GPU 显存百分比条 */
function ComfyUIDetails({ check }: { check: SystemCheckResult }) {
  const queueRunning = Number(check.data?.queueRunning ?? 0);
  const queuePending = Number(check.data?.queuePending ?? 0);
  const gpu = check.data?.gpu as
    | { name?: string; vramTotalMB?: number; vramUsedMB?: number; vramUsagePercent?: number }
    | null
    | undefined;

  return (
    <div className="space-y-3 pt-1">
      {/* 队列长度 */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-[var(--gold)]" />
          <span className="text-[var(--text-muted)]">队列</span>
          <span className="text-[var(--text-primary)] font-medium">
            运行 {queueRunning}
          </span>
          <span className="text-[var(--text-dim)]">/</span>
          <span className="text-[var(--text-primary)] font-medium">
            等待 {queuePending}
          </span>
        </div>
      </div>

      {/* GPU 显存 */}
      {gpu ? (
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-[var(--text-muted)]">
              {gpu.name || 'GPU'} 显存
            </span>
            <span className="font-mono text-[var(--text-secondary)]">
              {gpu.vramUsedMB ?? 0} / {gpu.vramTotalMB ?? 0} MB
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--gold-dark)] via-[var(--gold)] to-[var(--gold-bright)] transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, gpu.vramUsagePercent ?? 0))}%`,
              }}
            />
          </div>
          <div className="text-right text-xs text-[var(--text-muted)] mt-1">
            占用 {gpu.vramUsagePercent ?? 0}%
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <HelpCircle className="w-3.5 h-3.5" />
          无 GPU 显存数据
        </div>
      )}
    </div>
  );
}
