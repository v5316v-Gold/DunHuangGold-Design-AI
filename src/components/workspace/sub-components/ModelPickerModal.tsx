'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModelItem {
  id: string;
  label: string;
  available: boolean;
}

export interface ModelProvider {
  id: string;
  label: string;
  available: boolean;
  count: number;
  models: ModelItem[];
}

interface ModelPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelect: (modelId: string, providerId: string) => void;
}

/**
 * 模型选择 Modal（Phase 9.23 · 用户无感化）
 *
 * 设计稿参考：Claude/Cursor 风格的"设置会话模型"popup
 * - 顶部：标题 + 关闭
 * - 搜索框（实时过滤）
 * - 来源分组（折叠/展开 + 计数）—— 不展示 "Provider" 概念
 * - 选中模型显示 ✓
 * - 底部：来源选择器 + 自定义模型 ID 输入
 *
 * 注意：用户无感（docs §验证标准）—— 不直接暴露 provider 字样
 *   - 内部仍用 provider 概念传递（API 行为不变）
 *   - UI 仅展示"来源"或留空
 */
export function ModelPickerModal({
  isOpen,
  onClose,
  selectedModel,
  onSelect,
}: ModelPickerModalProps) {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 加载模型列表
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/models')
      .then((r) => r.json())
      .then((data) => {
        if (data?.providers) {
          setProviders(data.providers);
          // 默认展开第一个 available provider
          const firstAvailable = data.providers.find((p: ModelProvider) => p.available) || data.providers[0];
          if (firstAvailable) setExpandedProviders(new Set([firstAvailable.id]));
        }
        if (data?.default) {
          // 兼容老字段，新版不再使用 defaultProvider state
        }
      })
      .catch((err) => console.error('加载模型列表失败', err))
      .finally(() => setLoading(false));
  }, [isOpen]);

  // 自动聚焦搜索框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // 过滤后的 providers
  const filteredProviders = useMemo(() => {
    if (!searchQuery.trim()) return providers;
    const q = searchQuery.toLowerCase();
    return providers
      .map((p) => ({
        ...p,
        models: p.models.filter(
          (m) =>
            m.label.toLowerCase().includes(q) || p.label.toLowerCase().includes(q)
        ),
      }))
      .filter((p) => p.models.length > 0);
  }, [providers, searchQuery]);

  if (!isOpen) return null;

  const toggleProvider = (id: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (modelId: string, providerId: string) => {
    onSelect(modelId, providerId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-[640px] max-w-[92vw] max-h-[85vh] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            设置会话模型
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索模型..."
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--gold)] transition-all"
            />
          </div>
        </div>

        {/* 来源列表（用户无感 — docs §验证标准）*/}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {loading && (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">加载模型列表...</p>
          )}
          {!loading && filteredProviders.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">
              没有找到匹配的模型
            </p>
          )}
          {!loading &&
            filteredProviders.map((provider) => {
              const isExpanded = expandedProviders.has(provider.id) || searchQuery.trim().length > 0;
              return (
                <div key={provider.id} className="mb-4">
                  {/* 来源分组（用户无感）*/}
                  <button
                    onClick={() => toggleProvider(provider.id)}
                    className="w-full flex items-center justify-between py-2 text-sm hover:opacity-80 transition-all"
                  >
                    <div className="flex items-center gap-1.5">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                      )}
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {provider.label}
                      </span>
                      {!provider.available && (
                        <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-card)] px-1.5 py-0.5 rounded ml-1">
                          未启用
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {provider.models.length}
                    </span>
                  </button>

                  {/* Models */}
                  {isExpanded && (
                    <div className="ml-5 space-y-0.5">
                      {provider.models.map((model) => {
                        const isSelected = selectedModel === model.id;
                        const isDisabled = !model.available;
                        return (
                          <button
                            key={model.id}
                            onClick={() => !isDisabled && handleSelect(model.id, provider.id)}
                            disabled={isDisabled}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all',
                              isSelected && 'bg-[var(--bg-hover)]',
                              !isDisabled && !isSelected && 'hover:bg-[var(--bg-hover)]',
                              isDisabled && 'opacity-40 cursor-not-allowed'
                            )}
                          >
                            <span
                              className={cn(
                                'text-sm',
                                isSelected ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]',
                                isDisabled && 'text-[var(--text-muted)]'
                              )}
                            >
                              {model.label}
                            </span>
                            {isSelected && (
                              <Check className="w-4 h-4 text-[var(--gold)]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Footer：显示由管理员配置的模型数量提示 */}
        <div className="px-6 py-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/30">
          <p className="text-xs text-muted-foreground text-center">
            模型由后台管理员在「API 设置 → 大模型API」中配置
          </p>
        </div>
      </div>
    </div>
  );
}
