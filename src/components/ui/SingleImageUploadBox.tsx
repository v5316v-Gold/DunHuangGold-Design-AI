'use client';

import { Upload, X } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useImageUpload } from '@/hooks/useImageUpload';

interface SingleImageUploadBoxProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  placeholder?: string;
  subText?: string;
  disabled?: boolean;
  onClear?: () => void;
}

export function SingleImageUploadBox({
  value,
  onChange,
  placeholder = '点击或拖拽上传图片',
  subText,
  disabled = false,
  onClear,
}: SingleImageUploadBoxProps) {
  const { uploadedImage, isDragging, error, handleDrop, handleDragOver, handleDragLeave, handleFileSelect, clear } =
    useImageUpload({ multiple: false });

  const displayImage = value || uploadedImage;

  return (
    <div>
      {displayImage ? (
        <div className="relative">
          <div className="aspect-video bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] overflow-hidden">
            <Image src={displayImage} alt="已上传图片" className="w-full h-full object-contain" width={800} height={600} unoptimized />
          </div>
          {!disabled && (
            <button
              onClick={() => { clear(); onChange(null); onClear?.(); }}
              className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--bg-secondary)]/80 hover:bg-[var(--bg-hover)] transition-colors"
            >
              <X className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          )}
        </div>
      ) : (
        <label
          className={cn(
            'flex flex-col items-center justify-center aspect-video border-2 border-dashed rounded-lg cursor-pointer transition-all bg-[var(--bg-tertiary)]',
            disabled && 'opacity-50 cursor-not-allowed',
            isDragging
              ? 'border-[var(--gold)] bg-[var(--gold-muted)]'
              : 'border-[var(--border-color)] hover:border-[var(--gold)]',
          )}
          onDrop={disabled ? undefined : handleDrop}
          onDragOver={disabled ? undefined : handleDragOver}
          onDragLeave={disabled ? undefined : handleDragLeave}
        >
          <Upload className="w-8 h-8 text-[var(--text-muted)] mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">{placeholder}</p>
          {subText && <p className="text-xs text-[var(--text-muted)] mt-1">{subText}</p>}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              handleFileSelect(e);
              // 将 hook 的 uploadedImage 同步到外部
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => onChange(ev.target?.result as string);
                reader.readAsDataURL(file);
              }
            }}
            className="hidden"
            disabled={disabled}
          />
        </label>
      )}
      {error && <p className="mt-2 text-sm text-[var(--accent-red)]">{error}</p>}
    </div>
  );
}
