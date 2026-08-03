'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, Download, Trash2, Eye, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistoryItem {
  id: string;
  type: string;
  title: string;
  time: string;
  imageUrl?: string;
}

interface HistoryActionsProps {
  item: HistoryItem | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onDownload?: (item: HistoryItem) => void;
}

export default function HistoryActions({ item, onClose, onDelete, onDownload }: HistoryActionsProps) {
  const [deleting, setDeleting] = useState(false);

  if (!item) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete?.(item.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-sm max-h-[85vh] flex flex-col bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">作品操作</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-card)] transition-colors">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* 作品信息 */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            {item.imageUrl ? (
              <Image src={item.imageUrl} alt={item.title} className="w-12 h-12 rounded-lg object-cover" width={48} height={48} unoptimized />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-[var(--bg-card)] flex items-center justify-center">
                <Eye className="w-5 h-5 text-[var(--text-muted)]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[var(--text-primary)] truncate">{item.title}</p>
              <p className="text-xs text-[var(--text-muted)]">{item.type} · {item.time}</p>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="p-4 space-y-2">
          {item.imageUrl && (
            <button
              onClick={() => onDownload?.(item)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--bg-card)] rounded-xl hover:bg-[var(--border-color)] transition-colors"
            >
              <Download className="w-5 h-5 text-[var(--gold)]" />
              <span className="font-medium text-[var(--text-primary)]">下载作品</span>
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors',
              'text-red-500 hover:bg-red-500/10',
              deleting && 'opacity-50 cursor-not-allowed'
            )}
          >
            {deleting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Trash2 className="w-5 h-5" />
            )}
            <span className="font-medium">删除记录</span>
          </button>
        </div>
      </div>
    </div>
  );
}
