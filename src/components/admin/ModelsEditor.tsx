'use client';

import { useState } from 'react';
import { Plus, Trash2, RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  type ModelCategory,
} from '@/lib/provider-models-fetcher';

export interface ModelItem {
  id: string;
  label: string;
  enabled: boolean;
  /** 模型分类（可选，联网获取时填） */
  category?: ModelCategory;
}

interface ModelsEditorProps {
  models: ModelItem[];
  onChange: (models: ModelItem[]) => void;
  /** 联网获取所需的 provider / apiKey / endpoint */
  fetchConfig?: {
    provider: string;
    apiKey: string;
    endpoint: string;
  };
}

/**
 * 可用模型清单编辑器（管理员后台）
 * - 表格：ID | 标签 | 分类 | 启用
 * - 添加：ID + 标签 + [添加] 按钮
 * - 删除：行末 Trash2 按钮
 * - 启用：复选框切换
 * - 一键获取：从当前 provider 公开 API 拉取模型清单 + 自动分类
 */
export function ModelsEditor({ models, onChange, fetchConfig }: ModelsEditorProps) {
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<
    | { ok: true; count: number }
    | { ok: false; message: string }
    | null
  >(null);

  const handleAdd = () => {
    const id = newId.trim();
    if (!id) return;
    if (models.some((m) => m.id === id)) {
      alert(`模型 ID "${id}" 已存在`);
      return;
    }
    onChange([
      ...models,
      {
        id,
        label: newLabel.trim() || id,
        enabled: true,
      },
    ]);
    setNewId('');
    setNewLabel('');
  };

  const handleRemove = (idx: number) => {
    onChange(models.filter((_, i) => i !== idx));
  };

  const handleToggle = (idx: number) => {
    onChange(models.map((m, i) => (i === idx ? { ...m, enabled: !m.enabled } : m)));
  };
  const handleEdit = (idx: number, field: 'id' | 'label', value: string) => {
    onChange(models.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  };

  const handleCategoryChange = (idx: number, category: ModelCategory) => {
    onChange(models.map((m, i) => (i === idx ? { ...m, category } : m)));
  };

  /** 一键获取模型 */
  const handleFetch = async () => {
    if (!fetchConfig?.provider || !fetchConfig?.apiKey || !fetchConfig?.endpoint) {
      setFetchResult({ ok: false, message: '请先填写 API Key 和 endpoint' });
      return;
    }
    setFetching(true);
    setFetchResult(null);

    try {
      const res = await fetch('/api/admin/llm-providers/fetch-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: fetchConfig.provider,
          apiKey: fetchConfig.apiKey,
          endpoint: fetchConfig.endpoint,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setFetchResult({ ok: false, message: data.error || '拉取失败' });
        return;
      }

      // 合并：保留已存在，添加新模型（去重）
      const existingIds = new Set(models.map((m) => m.id));
      const fetched: ModelItem[] = (data.models || []).map((m: any) => ({
        id: m.id,
        label: m.label || m.id,
        enabled: !existingIds.has(m.id), // 已存在的保持原状态
        category: m.category,
      }));
      const newOnes = fetched.filter((m) => !existingIds.has(m.id));
      onChange([...models, ...newOnes]);
      setFetchResult({ ok: true, count: newOnes.length });
    } catch (err: any) {
      setFetchResult({ ok: false, message: err?.message || '网络错误' });
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* 一键获取 + 结果 */}
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleFetch}
          disabled={fetching || !fetchConfig?.apiKey}
          className="h-7 text-xs gap-1"
          title={!fetchConfig?.apiKey ? '请先填写 API Key' : '从 provider 拉取模型清单 + 自动分类'}
        >
          {fetching ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          一键获取模型
        </Button>
        {fetchResult && (
          <div className="flex items-center gap-1 text-xs">
            {fetchResult.ok ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span className="text-green-600">
                  拉取成功，新增 {fetchResult.count} 个
                </span>
              </>
            ) : (
              <>
                <XCircle className="w-3 h-3 text-red-500" />
                <span className="text-red-500">{fetchResult.message}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* 表格 */}
      <div className="border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--bg-card)]/30">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-card)] text-xs text-[var(--text-muted)]">
            <tr>
              <th className="text-left py-2 px-3 font-medium">模型 ID</th>
              <th className="text-left py-2 px-3 font-medium">标签</th>
              <th className="text-left py-2 px-3 font-medium w-24">分类</th>
              <th className="text-center py-2 px-3 font-medium w-16">启用</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {models.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 px-3 text-center text-xs text-[var(--text-muted)]">
                  暂无模型，使用下方添加 或 点击「一键获取模型」自动填充
                </td>
              </tr>
            )}
            {models.map((m, idx) => (
              <tr key={`${m.id}-${idx}`} className="hover:bg-[var(--bg-card)]/50">
                <td className="py-1 px-2">
                  <Input
                    value={m.id}
                    onChange={(e) => handleEdit(idx, 'id', e.target.value)}
                    className="h-7 text-xs font-mono bg-transparent border-transparent hover:border-[var(--border-color)] focus:border-[var(--gold)]"
                  />
                </td>
                <td className="py-1 px-2">
                  <Input
                    value={m.label}
                    onChange={(e) => handleEdit(idx, 'label', e.target.value)}
                    className="h-7 text-xs bg-transparent border-transparent hover:border-[var(--border-color)] focus:border-[var(--gold)]"
                  />
                </td>
                <td className="py-1 px-2">
                  <select
                    value={m.category || 'chat'}
                    onChange={(e) => handleCategoryChange(idx, e.target.value as ModelCategory)}
                    className="h-7 w-full text-xs bg-transparent border border-transparent hover:border-[var(--border-color)] focus:border-[var(--gold)] rounded px-1"
                  >
                    {(Object.keys(CATEGORY_LABELS) as ModelCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-1 px-2 text-center">
                  <input
                    type="checkbox"
                    checked={m.enabled}
                    onChange={() => handleToggle(idx)}
                    className="w-4 h-4 rounded accent-[var(--gold)] cursor-pointer"
                  />
                </td>
                <td className="py-1 px-2 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-[var(--text-muted)] hover:text-red-500 transition-colors p-1"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 添加行 */}
      <div className="flex gap-2">
        <Input
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="模型 ID（如 MiniMax-M4）"
          className="flex-1 h-8 text-xs font-mono"
        />
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="标签（可选）"
          className="flex-1 h-8 text-xs"
        />
        <Button
          type="button"
          size="sm"
          onClick={handleAdd}
          disabled={!newId.trim()}
          className="h-8 px-3 gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          添加
        </Button>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        勾选「启用」的模型会出现在 AI 对话界面中供用户选择。点击「一键获取模型」自动从 provider 拉取。
      </p>
    </div>
  );
}
