'use client';

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: 'w-4 h-4 border-[2px]',
  md: 'w-6 h-6 border-[2px]',
  lg: 'w-10 h-10 border-[3px]',
  xl: 'w-16 h-16 border-[4px]',
};

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        'border-[var(--gold)] border-t-transparent rounded-full animate-spin relative',
        sizeMap[size],
        className
      )}
      style={{
        boxShadow: '0 0 10px rgba(212, 175, 55, 0.3), inset 0 0 10px rgba(212, 175, 55, 0.1)',
      }}
    />
  );
}

interface LoadingDotsProps {
  className?: string;
  color?: 'gold' | 'white';
}

export function LoadingDots({ className, color = 'gold' }: LoadingDotsProps) {
  const colorClass = color === 'gold' ? 'bg-[var(--gold)]' : 'bg-white';
  const glowClass = color === 'gold' ? 'shadow-[0_0_6px_rgba(212,175,55,0.6)]' : '';
  
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'w-2.5 h-2.5 rounded-full animate-bounce',
            colorClass,
            glowClass
          )}
          style={{ 
            animationDelay: `${i * 150}ms`,
            animationDuration: '0.6s',
          }}
        />
      ))}
    </div>
  );
}

// 金沙流动 Loading
export function GoldSandLoader({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-16 h-16', className)}>
      {/* 外圈 */}
      <div 
        className="absolute inset-0 rounded-full border-2 border-[var(--gold)]/30"
        style={{ animation: 'spin 3s linear infinite' }}
      />
      {/* 中圈 */}
      <div 
        className="absolute inset-2 rounded-full border border-[var(--gold)]/50"
        style={{ animation: 'spin 2s linear infinite reverse' }}
      />
      {/* 内圈 */}
      <div 
        className="absolute inset-4 rounded-full border border-[var(--gold-border)]"
        style={{ animation: 'spin 1.5s linear infinite' }}
      />
      {/* 中心点 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="w-3 h-3 rounded-full bg-[var(--gold)]"
          style={{ boxShadow: '0 0 10px rgba(212, 175, 55, 0.6)' }}
        />
      </div>
    </div>
  );
}

// 金环脉冲 Loading
export function GoldRingPulse({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <div className={sizeMap[size].replace('border-[2px]', '').replace('border-[3px]', '').replace('border-[4px]', '')}>
        {/* 外环 */}
        <div 
          className={cn(
            'absolute rounded-full border-2 border-[var(--gold)]',
            size === 'sm' ? 'w-8 h-8 -m-2' : size === 'lg' ? 'w-16 h-16 -m-3' : 'w-12 h-12 -m-3'
          )}
          style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
        />
        {/* 中环 */}
        <div 
          className={cn(
            'absolute rounded-full border border-[var(--gold)]/50',
            size === 'sm' ? 'w-6 h-6 -m-1' : size === 'lg' ? 'w-12 h-12 -m-1' : 'w-8 h-8'
          )}
          style={{ animation: 'pulse 1.5s ease-in-out infinite 0.2s' }}
        />
        {/* 内环 */}
        <div 
          className={cn(
            'rounded-full bg-[var(--gold)]/20 border border-[var(--gold)]/30',
            sizeMap[size]
          )}
        />
      </div>
    </div>
  );
}

// 敦煌花纹 Loading
export function DunhuangLoader({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-20 h-20', className)}>
      <svg viewBox="0 0 80 80" className="w-full h-full">
        {/* 外圈八边形 */}
        <polygon
          points="40,4 68,18 76,46 68,74 40,88 12,74 4,46 12,18"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1"
          opacity="0.3"
          style={{ animation: 'spin 8s linear infinite' }}
        />
        {/* 中圈方形 */}
        <rect
          x="20" y="20" width="40" height="40"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1"
          opacity="0.4"
          style={{ animation: 'spin 6s linear infinite reverse' }}
        />
        {/* 内圈圆形 */}
        <circle
          cx="40" cy="40" r="16"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1.5"
          opacity="0.6"
          style={{ animation: 'spin 4s linear infinite' }}
        />
        {/* 中心点 */}
        <circle
          cx="40" cy="40" r="4"
          fill="var(--gold)"
          opacity="0.8"
          style={{ animation: 'pulse 2s ease-in-out infinite' }}
        />
      </svg>
    </div>
  );
}

interface LoadingOverlayProps {
  visible: boolean;
  text?: string;
  variant?: 'default' | 'sand' | 'ring';
}

export function LoadingOverlay({ visible, text = '加载中...', variant = 'default' }: LoadingOverlayProps) {
  if (!visible) return null;

  const loader = variant === 'sand' ? (
    <GoldSandLoader />
  ) : variant === 'ring' ? (
    <GoldRingPulse size="lg" />
  ) : (
    <LoadingSpinner size="lg" />
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{
        background: 'rgba(8, 8, 10, 0.9)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* 背景光晕 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[var(--gold)] opacity-[0.05] blur-[100px]" />
      </div>
      
      <div 
        className="flex flex-col items-center gap-6 p-8 rounded-2xl animate-scale-in relative z-10"
        style={{
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 60px rgba(212, 175, 55, 0.1)',
        }}
      >
        {/* 顶部装饰 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-[2px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-60 rounded-full" />
        
        {loader}
        
        <div className="flex flex-col items-center gap-2">
          <p className="text-[var(--text-primary)] text-sm font-medium">{text}</p>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-bounce" style={{ animationDelay: '100ms' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-bounce" style={{ animationDelay: '200ms' }} />
          </div>
        </div>
        
        {/* 底部装饰 */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-[2px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-60 rounded-full" />
      </div>
    </div>
  );
}

interface LoadingProgressBarProps {
  progress: number;
  className?: string;
  showLabel?: boolean;
}

export function LoadingProgressBar({ progress, className, showLabel = false }: LoadingProgressBarProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {showLabel && (
        <div className="flex justify-between text-xs">
          <span className="text-[var(--text-muted)]">进度</span>
          <span className="text-[var(--gold)] font-mono">{Math.round(progress)}%</span>
        </div>
      )}
      <div 
        className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden relative"
        style={{
          boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* 发光效果 */}
        <div 
          className="absolute inset-0 bg-gradient-to-r from-[var(--gold)]/20 to-[var(--gold)]/10"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
        {/* 进度条 */}
        <div
          className="h-full relative rounded-full transition-all duration-300 ease-out"
          style={{ 
            width: `${Math.min(100, Math.max(0, progress))}%`,
            background: 'linear-gradient(90deg, var(--gold-dark) 0%, var(--gold) 50%, var(--gold-bright) 100%)',
            boxShadow: '0 0 10px rgba(212, 175, 55, 0.5)',
          }}
        >
          {/* 高光 */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/30 to-transparent" />
        </div>
      </div>
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, variant = 'rectangular', width, height }: SkeletonProps) {
  const variantClass = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={cn('skeleton', variantClass[variant], className)}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div 
      className="p-4 rounded-xl relative overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
      }}
    >
      <Skeleton className="h-40 w-full mb-4 rounded-lg" />
      <Skeleton className="h-4 w-3/4 mb-2 rounded" />
      <Skeleton className="h-3 w-1/2 rounded" />
      
      {/* 角落装饰 */}
      <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-[var(--gold-border)] opacity-50" />
      <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-[var(--gold-border)] opacity-50" />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className="flex items-center gap-3 p-3 rounded-lg"
          style={{ background: 'var(--bg-tertiary)' }}
        >
          <Skeleton variant="circular" className="w-10 h-10" />
          <div className="flex-1">
            <Skeleton className="h-4 w-1/2 mb-2 rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// 生成中 Loading（用于图片生成等长时间操作）
interface GeneratingLoaderProps {
  progress?: number;
  className?: string;
}

export function GeneratingLoader({ progress, className }: GeneratingLoaderProps) {
  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* 环形进度 */}
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          {/* 背景环 */}
          <circle
            cx="40" cy="40" r="35"
            fill="none"
            stroke="var(--border-color)"
            strokeWidth="4"
          />
          {/* 进度环 */}
          <circle
            cx="40" cy="40" r="35"
            fill="none"
            stroke="var(--gold)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={220}
            strokeDashoffset={220 - (220 * (progress || 0)) / 100}
            style={{
              filter: 'drop-shadow(0 0 6px rgba(212, 175, 55, 0.5))',
              transition: 'stroke-dashoffset 0.3s ease',
            }}
          />
        </svg>
        {/* 中心百分比 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[var(--gold)] font-bold text-lg font-mono">
            {Math.round(progress || 0)}%
          </span>
        </div>
      </div>
      
      {/* 文字 */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-[var(--text-primary)] text-sm font-medium">正在生成中...</p>
        <p className="text-[var(--text-muted)] text-xs">预计需要 10-30 秒</p>
      </div>
      
      {/* 金沙流动点 */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]"
            style={{
              animation: 'pulse 1s ease-in-out infinite',
              animationDelay: `${i * 100}ms`,
              opacity: 0.4 + (i * 0.15),
            }}
          />
        ))}
      </div>
    </div>
  );
}
