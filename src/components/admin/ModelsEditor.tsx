'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface ModelItem {
  id: string;
  label: string;
  enabled: boolean;
}

interface ModelsEditorProps {
  models: ModelItem[];
  onChange: (models: ModelItem[]) => void;
}

/**
 * 可用模型清单编辑器（管理员后台）
 * - 表格：ID | 标签 | 启用
 * - 添加：ID + 标签 + [添加] 按钮
 * - 删除：行末 Trash2 按钮
 * - 启用：复选框切换
 */
export function ModelsEditor({ models, onChange }: ModelsEditorProps) {
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = () => {
    const id = newId.trim();
    if (!id) return;
    // 去重
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

  return (
    <div className="space-y-2">
      {/* 表格 */}
      <div className="border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--bg-card)]/30">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-card)] text-xs text-[var(--text-muted)]">
            <tr>
              <th className="text-left py-2 px-3 font-medium">模型 ID</th>
              <th className="text-left py-2 px-3 font-medium">标签</th>
              <th className="text-center py-2 px-3 font-medium w-16">启用</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {models.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 px-3 text-center text-xs text-[var(--text-muted)]">
                  暂无模型，使用下方添加
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
        勾选「启用」的模型会出现在 AI 对话界面中供用户选择
      </p>
    </div>
  );
}
