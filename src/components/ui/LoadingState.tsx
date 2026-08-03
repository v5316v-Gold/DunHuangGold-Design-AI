'use client';

import { cn } from '@/lib/utils';
import { 
  LoadingSpinner, 
  LoadingDots, 
  GoldSandLoader,
  LoadingOverlay,
  Skeleton,
  SkeletonCard,
  SkeletonList
} from '@/components/ui/loading';

interface LoadingStateProps {
  /** Loading state */
  loading: boolean;
  /** Custom loader component */
  loader?: React.ReactNode;
  /** Placeholder content shown while loading */
  placeholder?: React.ReactNode;
  /** Content shown when not loading */
  children: React.ReactNode;
  /** Custom class for wrapper */
  className?: string;
  /** Skeleton variant for placeholder */
  skeletonVariant?: 'card' | 'list' | 'custom';
  /** Number of skeleton items (for list) */
  skeletonCount?: number;
}

/**
 * Unified loading state component
 * Handles conditional rendering between loading and content states
 */
export function LoadingState({
  loading,
  loader,
  placeholder,
  children,
  className,
  skeletonVariant = 'card',
  skeletonCount = 3,
}: LoadingStateProps) {
  if (loading) {
    if (placeholder) {
      return <div className={className}>{placeholder}</div>;
    }

    if (loader) {
      return <div className={cn('flex items-center justify-center', className)}>{loader}</div>;
    }

    // Default skeleton placeholder
    return (
      <div className={className}>
        {skeletonVariant === 'card' && <SkeletonCard />}
        {skeletonVariant === 'list' && <SkeletonList count={skeletonCount} />}
      </div>
    );
  }

  return <>{children}</>;
}

interface LoadingButtonProps {
  loading: boolean;
  children: React.ReactNode;
  className?: string;
  spinnerSize?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

/**
 * Button with integrated loading state
 */
export function LoadingButton({
  loading,
  children,
  className,
  spinnerSize = 'sm',
  disabled,
}: LoadingButtonProps) {
  return (
    <button
      className={cn(
        'relative inline-flex items-center justify-center gap-2',
        loading && 'cursor-wait',
        className
      )}
      disabled={disabled || loading}
    >
      {loading && <LoadingSpinner size={spinnerSize} />}
      {children}
    </button>
  );
}

interface InlineLoadingProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'dots' | 'sand';
  className?: string;
}

/**
 * Inline loading indicator for use within text or small spaces
 */
export function InlineLoading({
  text = '加载中...',
  size = 'md',
  variant = 'spinner',
  className,
}: InlineLoadingProps) {
  const loaders = {
    spinner: <LoadingSpinner size={size} />,
    dots: <LoadingDots />,
    sand: <GoldSandLoader className="w-6 h-6" />,
  };

  return (
    <div className={cn('inline-flex items-center gap-2 text-sm text-[var(--text-muted)]', className)}>
      {loaders[variant]}
      <span>{text}</span>
    </div>
  );
}

export { LoadingOverlay, Skeleton, SkeletonCard, SkeletonList };
