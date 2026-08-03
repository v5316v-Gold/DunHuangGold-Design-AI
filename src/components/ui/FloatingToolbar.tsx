'use client';

import { useState, useRef } from 'react';

interface FloatingToolbarProps {
  inputValue: string;
  onOptimize?: () => Promise<void>;
  onTranslate?: (dir?: 'zh-en' | 'en-zh') => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export function FloatingToolbar({ inputValue, onOptimize, onTranslate, isLoading = false, className = '' }: FloatingToolbarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showTranslateMenu, setShowTranslateMenu] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setShowTranslateMenu(false);
    }, 300);
  };

  const handleOptimize = async () => {
    if (!inputValue.trim() || isOptimizing || isLoading || !onOptimize) return;
    setIsOptimizing(true);
    try {
      await onOptimize();
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleTranslate = async (dir: 'zh-en' | 'en-zh' = 'zh-en') => {
    if (!inputValue.trim() || isOptimizing || isLoading || !onTranslate) return;
    setIsOptimizing(true);
    try {
      await onTranslate(dir);
    } finally {
      setIsOptimizing(false);
    }
  };

  if (!inputValue.trim() && !isHovered) return null;

  return (
    <div
      className={`absolute bottom-2 right-2 z-50 transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-70'} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md shadow-lg p-1 flex items-center gap-0.5">
        <div className="flex items-center gap-2">
          <button
            onClick={handleOptimize}
            disabled={!inputValue.trim() || isOptimizing || isLoading}
            className="p-1 text-[9px] font-medium bg-[var(--gold)]/80 text-black rounded hover:bg-[var(--gold)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="润色提示词"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </button>
          <div className="relative">
            <button
              onClick={() => setShowTranslateMenu(!showTranslateMenu)}
              disabled={!inputValue.trim() || isOptimizing || isLoading}
              className="p-1 text-[9px] font-medium bg-[var(--bg-tertiary)]/60 text-[var(--text-secondary)] rounded hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="翻译"
            >
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 8l6 6M4 14l6-6 2-2M12 22V12M20 8l-4 4M2 2l20 20" />
              </svg>
            </button>
            {showTranslateMenu && (
              <div className="absolute bottom-full mb-1 right-0 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-lg py-1 min-w-[60px]">
                <button
                  onClick={() => { handleTranslate(); setShowTranslateMenu(false); }}
                  className="w-full px-2 py-1 text-[10px] text-left hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded"
                >
                  中文
                </button>
                <button
                  onClick={() => { handleTranslate(); setShowTranslateMenu(false); }}
                  className="w-full px-2 py-1 text-[10px] text-left hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded"
                >
                  English
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
