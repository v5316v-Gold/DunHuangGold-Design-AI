'use client';

/**
 * 功能管理页面 (Admin) - 2026-08-03 新建
 *
 * 路径: /admin/features
 *
 * 职责:
 *   - 列出所有设计工坊功能(从 src/config/features.ts FEATURE_DEFINITIONS)
 *   - 显示每个功能的算力、API 端点、启用状态
 *   - 提供"启用/停用"开关(调 /api/admin/features-status POST 单项检查,或
 *     /api/admin/feature-costs PUT 修改算力)
 *
 * 鉴权:
 *   - 通过 src/middleware.ts 在边缘运行时校验 role === 'admin'
 */

// 标记为动态渲染，避免静态生成时缺少客户端上下文（useContext null 错误）

// 注：本页面不需要再做客户端 role 检查（middleware 已处理）
// 数据源:
//   - 功能元数据: src/config/features.ts (静态导入)
//   - 当前算力:    /api/admin/feature-costs
//   - 启用状态:    /api/admin/features-status

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Shield,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Search,
  Filter,
} from 'lucide-react';
import {
  getAllFeatures,
  FeatureDefinition,
} from '@/config/features';

// 类别中文映射
const CATEGORY_LABELS: Record<FeatureDefinition['category'], string> = {
  image: '图片生成',
  '3d': '3D 建模',
  video: '视频生成',
  chat: 'AI 对话',
};

interface FeatureStatus {
  enabled: boolean;
  apiId: string;
  reason?: string;
}

interface FeatureCost {
  feature: string;
  name: string;
  cost: number;
}

export default function FeaturesManagementPage() {
  // 静态功能列表 (元数据,客户端零延迟)
  const allFeatures = useMemo(() => getAllFeatures(), []);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statuses, setStatuses] = useState<Record<string, FeatureStatus>>({});
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingCost, setEditingCost] = useState<Record<string, string>>({});
  const [savingCost, setSavingCost] = useState<string | null>(null);

  // 加载状态和算力
  const loadData = async (showSpinner = true) => {
    if (showSpinner) setRefreshing(true);
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('dunhuang_token') || localStorage.getItem('auth_token')
          : null;
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      // 并行加载
      const [statusRes, costRes] = await Promise.all([
        fetch('/api/admin/features-status', { credentials: 'include', headers })
        
          .then((r) => r.json())
          .catch(() => null),
        fetch('/api/admin/feature-costs', { credentials: 'include', headers })
        
          .then((r) => r.json())
          .catch(() => null),
      ]);

      // 解析 status
      if (statusRes?.success) {
        // /api/admin/features-status 返回的格式可能是 { features: [...] } 或直接是数组
        const data = statusRes.data;
        let statusMap: Record<string, FeatureStatus> = {};
        if (Array.isArray(data)) {
          data.forEach((s: any) => {
            statusMap[s.featureId || s.id] = s;
          });
        } else if (data?.features && Array.isArray(data.features)) {
          data.features.forEach((s: any) => {
            statusMap[s.featureId || s.id] = s;
          });
        } else if (typeof data === 'object' && data !== null) {
          statusMap = data as Record<string, FeatureStatus>;
        }
        setStatuses(statusMap);
      }

      // 解析 cost
      if (costRes?.success) {
        const costMap: Record<string, number> = {};
        const list: FeatureCost[] = costRes.data?.features || [];
        list.forEach((f) => {
          costMap[f.feature] = f.cost;
        });
        setCosts(costMap);
      }
    } catch (e) {
      console.error('[features-mgmt] 加载失败:', e);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // 过滤
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allFeatures.filter((f) => {
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      if (q && !f.name.toLowerCase().includes(q) && !f.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allFeatures, search, categoryFilter]);

  // 统计
  const stats = useMemo(() => {
    const total = allFeatures.length;
    const enabled = allFeatures.filter((f) => statuses[f.id]?.enabled !== false).length;
    const disabled = total - enabled;
    return { total, enabled, disabled };
  }, [allFeatures, statuses]);

  // 类别分布
  const categories = useMemo(() => {
    const set = new Set<FeatureDefinition['category']>();
    allFeatures.forEach((f) => set.add(f.category));
    return Array.from(set);
  }, [allFeatures]);

  // 保存单个算力
  const handleSaveCost = async (featureId: string) => {
    const raw = editingCost[featureId];
    if (raw === undefined) return;
    const cost = parseInt(raw);
    if (Number.isNaN(cost) || cost < 0) {
      toast.error('算力值必须为非负整数');
      return;
    }

    setSavingCost(featureId);
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('dunhuang_token') || localStorage.getItem('auth_token')
          : null;
      const res = await fetch('/api/admin/feature-costs', {
        credentials: 'include',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ features: { [featureId]: cost } }),
      });
      const data = await res.json();
      if (data.success) {
        setCosts((prev) => ({ ...prev, [featureId]: cost }));
        setEditingCost((prev) => {
          const { [featureId]: _drop, ...rest } = prev;
          return rest;
        });
        toast.success(`${featureId} 算力已更新为 ${cost}`);
      } else {
        toast.error(data.error || '保存失败');
      }
    } catch (e) {
      console.error('[features-mgmt] 保存算力失败:', e);
      toast.error('保存失败');
    } finally {
      setSavingCost(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* 顶部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--gold)]/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[var(--gold)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">功能管理</h1>
              <p className="text-sm text-[var(--text-muted)]">设计工坊功能启用与算力配置</p>
            </div>
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card)] rounded-lg text-sm text-[var(--text-secondary)] hover:bg-[var(--gold)] hover:text-black transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
            <div className="text-sm text-[var(--text-muted)]">总功能数</div>
            <div className="text-2xl font-bold text-[var(--text-primary)] mt-1">{stats.total}</div>
          </div>
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
            <div className="text-sm text-[var(--text-muted)]">已启用</div>
            <div className="text-2xl font-bold text-green-500 mt-1">{stats.enabled}</div>
          </div>
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
            <div className="text-sm text-[var(--text-muted)]">已停用</div>
            <div className="text-2xl font-bold text-red-500 mt-1">{stats.disabled}</div>
          </div>
        </div>

        {/* 过滤栏 */}
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4 mb-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索功能名或 ID..."
              className="flex-1 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)]"
            >
              <option value="all">全部分类</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c] || c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 功能表格 */}
        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--bg-card)]">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]">
                  功能
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]">
                  分类
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)]">
                  云端/本地
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-secondary)]">
                  算力
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-secondary)]">
                  状态
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-[var(--text-secondary)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[var(--text-muted)]">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    加载中...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[var(--text-muted)]">
                    暂无匹配的功能
                  </td>
                </tr>
              ) : (
                filtered.map((feature) => {
                  const status = statuses[feature.id];
                  const cost = costs[feature.id] ?? costs[feature.id.toLowerCase()] ?? '—';
                  const isEditing = feature.id in editingCost;
                  const isSaving = savingCost === feature.id;

                  return (
                    <tr key={feature.id} className="hover:bg-[var(--bg-card)] transition-all">
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-[var(--text-primary)]">
                            {feature.name}
                          </div>
                          <div className="text-xs text-[var(--text-muted)] mt-0.5">
                            {feature.description}
                          </div>
                          <div className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">
                            {feature.id}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {CATEGORY_LABELS[feature.category] || feature.category}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[var(--text-primary)]">
                            {feature.defaultCloudProvider}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">
                            {feature.defaultLocalProvider}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min={0}
                              value={editingCost[feature.id]}
                              onChange={(e) =>
                                setEditingCost((prev) => ({
                                  ...prev,
                                  [feature.id]: e.target.value,
                                }))
                              }
                              className="w-20 px-2 py-1 text-sm bg-[var(--bg-card)] border border-[var(--gold)] rounded text-center text-[var(--text-primary)] focus:outline-none"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-[var(--gold)]">{cost}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {status?.enabled === false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-500">
                            <XCircle className="w-3 h-3" />
                            停用
                          </span>
                        ) : status?.enabled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-500">
                            <CheckCircle2 className="w-3 h-3" />
                            启用
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-500 cursor-help"
                            title={status?.reason || '未知状态'}
                          >
                            <AlertCircle className="w-3 h-3" />
                            待检查
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleSaveCost(feature.id)}
                              disabled={isSaving}
                              className="px-2 py-1 bg-[var(--gold)] text-black text-xs rounded hover:opacity-80 disabled:opacity-50"
                            >
                              {isSaving ? '...' : '保存'}
                            </button>
                            <button
                              onClick={() =>
                                setEditingCost((prev) => {
                                  const { [feature.id]: _, ...rest } = prev;
                                  return rest;
                                })
                              }
                              className="px-2 py-1 bg-[var(--bg-card)] text-[var(--text-muted)] text-xs rounded hover:bg-[var(--bg-hover)]"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              setEditingCost((prev) => ({ ...prev, [feature.id]: String(cost) }))
                            }
                            className="px-2 py-1 bg-[var(--bg-card)] text-[var(--text-secondary)] text-xs rounded hover:bg-[var(--gold)] hover:text-black transition-all"
                          >
                            编辑算力
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 提示 */}
        <div className="mt-4 p-3 bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] flex items-start gap-2 text-xs text-[var(--text-muted)]">
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--gold)]" />
          <div>
            <strong>功能启用/停用</strong>需要在
            <code className="px-1 mx-1 bg-[var(--bg-primary)] rounded">/admin/api-settings</code>
            配置对应 API Key 后才会显示为&quot;启用&quot;。算力调整会立即保存到
            <code className="px-1 mx-1 bg-[var(--bg-primary)] rounded">system_settings</code>
            表,前端{' '}
            <code className="px-1 mx-1 bg-[var(--bg-primary)] rounded">
              /api/admin/feature-costs
            </code>{' '}
            可读取。
          </div>
        </div>
      </div>
    </div>
  );
}
