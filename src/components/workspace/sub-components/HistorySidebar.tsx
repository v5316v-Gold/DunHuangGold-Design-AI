'use client';

import { CheckSquare, Square, Clock, Download, Trash2, RefreshCw, X } from 'lucide-react';
import Image from 'next/image';

export interface HistoryItemData {
  id: string;
  imageUrl: string;
  prompt?: string;
  timestamp?: Date;
}

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItemData[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onClearAll: () => void;
  onPreview: (item: HistoryItemData) => void;
  onDownload: (item: HistoryItemData) => void;
}

export function HistorySidebar({
  isOpen,
  onClose,
  history,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeleteSelected,
  onClearAll,
  onPreview,
  onDownload,
}: HistorySidebarProps) {
  if (!isOpen) return null;

  return (
    <div className="w-[280px] min-w-[280px] bg-[var(--bg-secondary)] border-l border-[var(--border-color)] flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <button
            onClick={onSelectAll}
            className="w-5 h-5 rounded flex items-center justify-center transition-all"
          >
            {selectedIds.size === history.length && history.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-[var(--gold)]" />
            ) : (
              <Square className="w-4 h-4 text-[var(--text-muted)]" />
            )}
          </button>
          <span className="text-sm font-medium text-[var(--text-primary)]">历史记录</span>
          {selectedIds.size > 0 && (
            <span className="text-xs text-[var(--text-muted)]">({selectedIds.size})</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* History Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {history.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">暂无历史记录</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {history.map((item) => (
              <div
                key={item.id}
                onDoubleClick={() => onPreview(item)}
                className={selectedIds.has(item.id)
                  ? 'relative aspect-square bg-[var(--bg-card)] rounded-lg overflow-hidden border-2 border-[var(--gold)] transition-all cursor-pointer'
                  : 'group relative aspect-square bg-[var(--bg-card)] rounded-lg overflow-hidden border border-[var(--border-color)] hover:border-[var(--gold)] transition-all cursor-pointer'
                }
              >
                {/* Selection checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleSelect(item.id); }}
                  className="absolute top-2 right-2 z-10 w-6 h-6 rounded bg-black/50 backdrop-blur flex items-center justify-center hover:bg-black/70 transition-all"
                >
                  {selectedIds.has(item.id) ? (
                    <CheckSquare className="w-4 h-4 text-[var(--gold)]" />
                  ) : (
                    <Square className="w-4 h-4 text-white/70" />
                  )}
                </button>

                <Image
                  src={item.imageUrl}
                  alt={item.prompt || '历史记录'}
                  className="w-full h-full object-cover"
                  width={200}
                  height={200}
                  unoptimized
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-[var(--border-color)]">
        {selectedIds.size > 0 ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                history
                  .filter(item => selectedIds.has(item.id))
                  .forEach(item => onDownload(item));
              }}
              className="flex-1 py-2 text-sm text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--gold)] transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              下载 ({selectedIds.size})
            </button>
            <button
              onClick={onDeleteSelected}
              className="flex-1 py-2 text-sm text-[var(--accent-red)] border border-[var(--accent-red)]/30 rounded-lg hover:bg-[var(--accent-red)]/10 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              删除 ({selectedIds.size})
            </button>
          </div>
        ) : (
          <button
            onClick={onClearAll}
            disabled={history.length === 0}
            className="w-full h-12 text-sm text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--accent-red)] hover:text-[var(--accent-red)] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            清空历史
          </button>
        )}
      </div>
    </div>
  );
}
