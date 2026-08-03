'use client';

import { ZoomIn, ZoomOut, RotateCw, Download } from 'lucide-react';

interface ImageToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onDownload: () => void;
}

export function ImageToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onDownload,
}: ImageToolbarProps) {
  return (
    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2">
      <button
        onClick={onZoomOut}
        className="w-8 h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-all"
        title="缩小"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
      <span className="text-xs text-[var(--text-muted)] px-2">{Math.round(zoom * 100)}%</span>
      <button
        onClick={onZoomIn}
        className="w-8 h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-all"
        title="放大"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <button
        onClick={onZoomReset}
        className="w-8 h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-all"
        title="重置"
      >
        <RotateCw className="w-4 h-4" />
      </button>
      <div className="w-px h-4 bg-[var(--border-color)] mx-1" />
      <button
        onClick={onDownload}
        className="w-8 h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--gold)] hover:border-[var(--gold)] transition-all"
        title="下载"
      >
        <Download className="w-4 h-4" />
      </button>
    </div>
  );
}
