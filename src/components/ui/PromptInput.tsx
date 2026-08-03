'use client';

import { FloatingToolbar } from './FloatingToolbar';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onOptimize: () => Promise<void>;
  onTranslate?: (dir?: 'zh-en' | 'en-zh') => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  height?: string;
  bgClass?: string;
  className?: string;
  disabled?: boolean;
}

export function PromptInput({
  value,
  onChange,
  onOptimize,
  onTranslate,
  isLoading = false,
  placeholder = '输入提示词...',
  height = 'h-20',
  bgClass = 'bg-[var(--bg-card)]',
  className = '',
  disabled = false,
}: PromptInputProps) {
  return (
    <div className={`relative group ${className}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full ${height} ${bgClass} border border-[var(--border-color)] rounded-lg px-3 py-2 pr-16 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none focus:border-[var(--gold)] focus:outline-none transition-all`}
        disabled={disabled}
      />
      <FloatingToolbar
        inputValue={value}
        onOptimize={onOptimize}
        onTranslate={onTranslate}
        isLoading={isLoading}
        className="bottom-2 right-2"
      />
    </div>
  );
}
