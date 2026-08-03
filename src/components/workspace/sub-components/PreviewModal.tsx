'use client';

import { X, Download, Heart, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { HistoryItemData } from './HistorySidebar';

interface PreviewModalProps {
  item: HistoryItemData | null;
  onClose: () => void;
  onDownload: (item: HistoryItemData) => void;
  likedImages?: Set<string>;
  onLike?: (id: string) => void;
  onUsePrompt?: (prompt: string) => void;
}

export function PreviewModal({ item, onClose, onDownload, likedImages, onLike, onUsePrompt }: PreviewModalProps) {
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all z-10"
      >
        <X className="w-5 h-5" />
      </button>

      <div
        className="flex flex-row items-stretch max-w-[92vw] max-h-[88vh] gap-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <Image
          src={item.imageUrl}
          alt={item.prompt || '预览'}
          className="max-h-[88vh] w-auto object-contain rounded-xl shadow-2xl"
          width={1920}
          height={1080}
          unoptimized
        />

        {/* Right panel: prompt + actions */}
        <div className="w-64 min-w-64 flex flex-col bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] overflow-hidden self-stretch">
          {item.prompt ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 overflow-x-hidden">
                <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-all">{item.prompt}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 px-4 py-3 border-t border-[var(--border-color)]">
                {onUsePrompt && (
                  <button
                    onClick={() => { onUsePrompt(item.prompt!); onClose(); }}
                    className="h-9 px-4 rounded-lg font-medium bg-[var(--gold)] text-black hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                    style={{ boxShadow: '0 4px 15px rgba(212,175,55,0.3)' }}
                  >
                    <Sparkles className="w-4 h-4" />
                    使用提示词
                  </button>
                )}
                {onLike && likedImages && (
                  <button
                    onClick={() => onLike(item.id)}
                    className={cn(
                      'h-9 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all text-sm',
                      likedImages.has(item.id)
                        ? 'bg-[var(--gold-muted)] text-[var(--gold)] border border-[var(--gold)]/50'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--gold)]'
                    )}
                  >
                    <Heart className={cn('w-4 h-4', likedImages.has(item.id) && 'fill-current')} />
                    {likedImages.has(item.id) ? '已点赞' : '点赞'}
                  </button>
                )}
                <button
                  onClick={() => onDownload(item)}
                  className="h-9 px-4 rounded-lg font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--gold)] transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  下载
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-[var(--text-muted)]">无提示词信息</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
