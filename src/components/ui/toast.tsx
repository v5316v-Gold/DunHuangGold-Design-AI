'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

// 全局状态
let toastId = 0;
let listeners: Array<(toasts: Toast[]) => void> = [];
let currentToasts: Toast[] = [];

function notifyListeners() {
  listeners.forEach((listener) => listener([...currentToasts]));
}

function addToast(toast: Omit<Toast, 'id'>) {
  const id = `toast-${++toastId}`;
  const duration = toast.duration ?? 5000;
  const newToast: Toast = {
    ...toast,
    id,
    duration,
  };
  currentToasts = [...currentToasts, newToast];
  notifyListeners();

  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
}

function removeToast(id: string) {
  currentToasts = currentToasts.filter((t) => t.id !== id);
  notifyListeners();
}

// Hook for using toast
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter((l) => l !== setToasts);
    };
  }, []);

  return {
    toasts,
    toast: addToast,
    dismiss: removeToast,
    success: (title: string, description?: string) => addToast({ type: 'success', title, description }),
    error: (title: string, description?: string) => addToast({ type: 'error', title, description }),
    info: (title: string, description?: string) => addToast({ type: 'info', title, description }),
    warning: (title: string, description?: string) => addToast({ type: 'warning', title, description }),
  };
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const colorMap = {
  success: 'text-[var(--success-green)]',
  error: 'text-[var(--accent-red)]',
  info: 'text-[var(--info-blue)]',
  warning: 'text-[var(--warning-yellow)]',
};

const borderMap = {
  success: 'border-l-[var(--success-green)]',
  error: 'border-l-[var(--accent-red)]',
  info: 'border-l-[var(--info-blue)]',
  warning: 'border-l-[var(--warning-yellow)]',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = iconMap[toast.type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 bg-[var(--bg-elevated)] border border-[var(--border-color)] border-l-2 rounded-lg shadow-lg animate-slide-in-right',
        borderMap[toast.type]
      )}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', colorMap[toast.type])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{toast.description}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
      >
        <X className="w-4 h-4 text-[var(--text-muted)]" />
      </button>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed top-[72px] right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={() => dismiss(toast.id)} />
        </div>
      ))}
    </div>
  );
}
