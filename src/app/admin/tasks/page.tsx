'use client';

/**
 * 任务中心页面 (Admin) - 2026-08-03 新建
 *
 * 路径: /admin/tasks
 *
 * 职责:
 *   - 分页展示所有生成任务（id / featureCode / status / executor / progress / retry / 耗时）
 *   - 状态筛选（全部 / pending / running / succeeded / failed / cancelled）
 *   - 失败/已取消任务可【重试】，排队/执行中可【取消】
 *   - 点击行展开详情（input / output / error，走 GET /api/admin/tasks/[id]）
 *
 * 数据源:
 *   - 列表: GET /api/admin/tasks?page=&pageSize=&status=&feature=
 *   - 详情: GET /api/admin/tasks/[id]
 *   - 重试: POST /api/admin/tasks/[id]/retry
 *   - 取消: POST /api/admin/tasks/[id]/cancel
 *
 * 鉴权:
 *   - API 层 requireAdmin（admin / superadmin）+ logAudit
 *   - 页面通过 getAuthHeader() 附带 Bearer token
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  ListTodo,
  RefreshCw,
  RotateCcw,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Inbox,
} from 'lucide-react';
import { getAuthHeader } from '@/hooks/useAuth';

// ==================== 类型定义 ====================

interface TaskItem {
  id: string;
  userId: string;
  featureCode: string | null;
  type: string;
  status: string;
  executor: string | null;
  progress: number | null;
  retryCount: number | null;
  maxRetries: number | null;
  error: string | null;
  powerCost: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
}

interface TaskDetail extends TaskItem {
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
}

interface TasksResponse {
  success: boolean;
  data: { items: TaskItem[]; total: number; page: number; pageSize: number };
  error: { code?: string; message?: string } | null;
}

// ==================== 常量 ====================

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'pending', label: '排队中' },
  { value: 'running', label: '执行中' },
  { value: 'succeeded', label: '成功' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: '排队中',
  running: '执行中',
  succeeded: '成功',
  failed: '失败',
  cancelled: '已取消',
};

// 状态徽章颜色：pending=灰 / running=金 / succeeded=绿 / failed=红 / cancelled=灰
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-gray-500/15 text-gray-400 border border-gray-500/30';
    case 'running':
      return 'bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/40 shadow-[0_0_10px_rgba(200,164,92,0.25)]';
    case 'succeeded':
      return 'bg-green-500/15 text-green-500 border border-green-500/30';
    case 'failed':
      return 'bg-red-500/15 text-red-500 border border-red-500/30';
    case 'cancelled':
      return 'bg-gray-600/15 text-gray-500 border border-gray-600/30';
    default:
      return 'bg-gray-500/15 text-gray-400 border border-gray-500/30';
  }
}

// 功能 ID → 中文名
const FEATURE_NAMES: Record<string, string> = {
  dialogue: 'AI对话',
  text2img: '文案生图',
  refine: '产品精修',
  blend: '多图融合',
  oneclick: '一键设计',
  multiview: '生成多视图',
  sketch: '线稿/写实',
  '3d': '3D建模',
  video: '视频生成',
};

// ==================== 工具函数 ====================

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 耗时：completedAt - createdAt；未完成则显示进行中
function formatDuration(item: TaskItem): string {
  if (item.completedAt && item.createdAt) {
    const ms = new Date(item.completedAt).getTime() - new Date(item.createdAt).getTime();
    if (isNaN(ms) || ms < 0) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }
  if (item.status === 'running') return '进行中…';
  if (item.status === 'pending') return '排队中';
  return '-';
}

function featureLabel(code: string | null): string {
  if (!code) return '-';
  return FEATURE_NAMES[code] || code;
}

// ==================== 页面组件 ====================

export default function TasksManagementPage() {
  const [items, setItems] = useState<TaskItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, TaskDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchTasks = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setRefreshing(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (statusFilter) params.set('status', statusFilter);

        const res = await fetch(`/api/admin/tasks?${params.toString()}`, {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        const data: TasksResponse = await res.json();
        if (data.success) {
          setItems(data.data.items);
          setTotal(data.data.total);
        } else {
          toast.error(data.error?.message || '加载任务列表失败');
        }
      } catch (error) {
        console.error('获取任务列表失败:', error);
        toast.error('加载任务列表失败，请重试');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, pageSize, statusFilter]
  );

  useEffect(() => {
    setLoading(true);
    fetchTasks(false);
  }, [fetchTasks]);

  // 切换状态筛选时回到第一页
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
    setExpandedId(null);
  };

  // 展开/收起详情（懒加载）
  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!detailCache[id]) {
      setDetailLoading(id);
      try {
        const res = await fetch(`/api/admin/tasks/${id}`, {
          credentials: 'include',
          headers: { ...getAuthHeader() },
        });
        const data = await res.json();
        if (data.success) {
          setDetailCache((prev) => ({ ...prev, [id]: data.data }));
        } else {
          toast.error(data.error?.message || '加载任务详情失败');
        }
      } catch (error) {
        console.error('获取任务详情失败:', error);
        toast.error('加载任务详情失败');
      } finally {
        setDetailLoading(null);
      }
    }
  };

  // 重试
  const handleRetry = async (id: string) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/tasks/${id}/retry`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('任务已重新入队');
        setExpandedId(null);
        fetchTasks(false);
      } else {
        toast.error(data.error?.message || '重试失败');
      }
    } catch (error) {
      console.error('重试任务失败:', error);
      toast.error('重试失败，请重试');
    } finally {
      setActingId(null);
    }
  };

  // 取消
  const handleCancel = async (id: string) => {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/tasks/${id}/cancel`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      });
      const data = await res.json();
      if (data.success) {
        toast.success('任务已取消');
        setExpandedId(null);
        fetchTasks(false);
      } else {
        toast.error(data.error?.message || '取消失败');
      }
    } catch (error) {
      console.error('取消任务失败:', error);
      toast.error('取消失败，请重试');
    } finally {
      setActingId(null);
    }
  };

  // 操作列按钮
  const renderActions = (item: TaskItem) => {
    const canRetry = item.status === 'failed' || item.status === 'cancelled';
    const canCancel = item.status === 'pending' || item.status === 'running';
    const busy = actingId === item.id;

    return (
      <div className="flex gap-2">
        {canRetry && (
          <button
            onClick={() => handleRetry(item.id)}
            disabled={busy}
            className="flex items-center gap-1 px-3 py-1 bg-[var(--gold)]/20 text-[var(--gold)] rounded text-xs hover:bg-[var(--gold)] hover:text-black transition-all disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" />
            {busy ? '处理中…' : '重试'}
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => handleCancel(item.id)}
            disabled={busy}
            className="flex items-center gap-1 px-3 py-1 bg-red-500/15 text-red-500 rounded text-xs hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
          >
            <XCircle className="w-3 h-3" />
            {busy ? '处理中…' : '取消'}
          </button>
        )}
        {!canRetry && !canCancel && <span className="text-xs text-[var(--text-muted)]">—</span>}
      </div>
    );
  };

  // 展开详情区域
  const renderDetail = (item: TaskItem) => {
    if (expandedId !== item.id) return null;
    const detail = detailCache[item.id];
    const loadingDetail = detailLoading === item.id;

    const JsonBlock = ({ title, value }: { title: string; value: unknown }) => (
      <div className="flex-1 min-w-[240px]">
        <p className="text-xs text-[var(--text-muted)] mb-1">{title}</p>
        <pre className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-3 text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
          {value === null || value === undefined
            ? '无'
            : typeof value === 'string'
              ? value
              : JSON.stringify(value, null, 2)}
        </pre>
      </div>
    );

    return (
      <tr className="bg-[var(--bg-primary)]/60">
        <td colSpan={9} className="px-4 py-4 border-t border-[var(--border-color)]">
          <div className="grid grid-cols-2 gap-4">
            <JsonBlock title="输入 input" value={detail?.input ?? null} />
            <JsonBlock title="输出 output" value={detail?.output ?? null} />
            <div className="col-span-2">
              <JsonBlock title="错误信息 error" value={detail?.error ?? item.error ?? null} />
            </div>
          </div>
          {loadingDetail && (
            <div className="flex items-center gap-2 mt-3 text-xs text-[var(--text-muted)]">
              <RefreshCw className="w-3 h-3 animate-spin" />
              加载详情中…
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6">
      {/* 顶部：标题 + 筛选 + 刷新 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/15 flex items-center justify-center border border-[var(--gold)]/30">
            <ListTodo className="w-5 h-5 text-[var(--gold)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">任务中心</h1>
            <p className="text-sm text-[var(--text-muted)]">
              共 {total} 个任务 · 第 {page} / {totalPages} 页
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchTasks()}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--gold)] hover:text-black hover:border-transparent transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* 状态筛选 */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleStatusChange(opt.value)}
            className={`px-4 py-1.5 rounded-full text-sm transition-all border ${
              statusFilter === opt.value
                ? 'bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/50 shadow-[0_0_12px_rgba(200,164,92,0.35)]'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--gold)]/40 hover:text-[var(--gold)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 任务表格 */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--bg-card)]">
            <tr>
              {['任务ID', '功能', '状态', '执行器', '进度', '重试', '耗时', '创建时间', '操作'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)] whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-[var(--text-muted)]">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[var(--gold)]" />
                  加载中...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-[var(--text-muted)]">
                  <Inbox className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  暂无任务数据
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <FragmentRow
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  onToggle={() => toggleExpand(item.id)}
                  renderDetail={() => renderDetail(item)}
                  renderActions={() => renderActions(item)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between mt-6">
        <span className="text-sm text-[var(--text-muted)]">
          共 {total} 条记录
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40 transition-all disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            上一页
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            // 页码窗口：当前页前后各 2 页
            let start = Math.max(1, page - 2);
            const end = Math.min(totalPages, start + 4);
            start = Math.max(1, end - 4);
            const p = start + i;
            if (p > totalPages) return null;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-9 h-9 rounded-lg text-sm transition-all ${
                  p === page
                    ? 'bg-[var(--gold)] text-black font-medium shadow-[0_0_12px_rgba(200,164,92,0.4)]'
                    : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40'
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--gold)] hover:border-[var(--gold)]/40 transition-all disabled:opacity-40"
          >
            下一页
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// 行组件（tr 无法直接包在 Fragment 条件中渲染展开行，单独抽组件保持结构合法）
function FragmentRow({
  item,
  expanded,
  onToggle,
  renderDetail,
  renderActions,
}: {
  item: TaskItem;
  expanded: boolean;
  onToggle: () => void;
  renderDetail: () => ReactNode;
  renderActions: () => ReactNode;
}) {
  const expandable = ['pending', 'running', 'succeeded', 'failed', 'cancelled'].includes(
    item.status
  );
  return (
    <>
      <tr
        onClick={onToggle}
        className="hover:bg-[var(--bg-card)]/60 transition-all cursor-pointer"
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {expandable &&
              (expanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-[var(--gold)] shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              ))}
            <span className="text-sm font-mono text-[var(--text-secondary)]">
              {item.id.slice(0, 8)}…
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-[var(--text-primary)]">
          {featureLabel(item.featureCode)}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(item.status)}`}
          >
            {STATUS_LABELS[item.status] || item.status}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{item.executor || '-'}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-[var(--bg-card)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-hover)] rounded-full transition-all"
                style={{ width: `${Math.min(100, item.progress ?? 0)}%` }}
              />
            </div>
            <span className="text-xs text-[var(--text-muted)] w-9">
              {item.progress ?? 0}%
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
          <span className={item.retryCount ? 'text-[var(--gold)]' : ''}>
            {item.retryCount ?? 0}
          </span>
          <span className="text-xs text-[var(--text-muted)]/70">
            /{item.maxRetries ?? 3}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-[var(--text-muted)] whitespace-nowrap">
          {formatDuration(item)}
        </td>
        <td className="px-4 py-3 text-sm text-[var(--text-muted)] whitespace-nowrap">
          {formatTime(item.createdAt)}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {renderActions()}
        </td>
      </tr>
      {expanded && renderDetail()}
    </>
  );
}
