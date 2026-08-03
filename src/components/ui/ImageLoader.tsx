'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ImageIcon, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageLoaderProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
  showPlaceholder?: boolean;
}

/**
 * 通用图片加载组件
 * 支持多种图片源类型：
 * 1. Base64数据
 * 2. 直接URL
 * 3. 代理URL（通过后端转发）
 * 
 * 自动处理：
 * - 加载状态
 * - 错误处理
 * - CORS问题
 * - 代理转发
 */
export default function ImageLoader({
  src,
  alt = 'Image',
  className,
  fallback,
  showPlaceholder = true,
}: ImageLoaderProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [proxySrc, setProxySrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      setError(false);
      setProxySrc(null);
      return;
    }

    setLoading(true);
    setError(false);

    // 检查是否是Base64数据
    if (typeof src === 'string' && src.startsWith('data:')) {
      setProxySrc(src);
      setLoading(false);
      return;
    }

    // 检查是否是相对路径（本地图标等）
    if (typeof src === 'string' && (src.startsWith('/') || src.startsWith('./') || src.startsWith('../'))) {
      setProxySrc(src);
      setLoading(false);
      return;
    }

    // 检查是否是代理URL或其他特殊URL
    // 这些URL可能需要通过后端代理才能访问
    const needsProxy = typeof src === 'string' && (
      src.includes('file/proxy') ||
      src.includes('localhost') ||
      src.includes('127.0.0.1'));

    if (needsProxy) {
      // eslint-disable-next-line react-hooks/immutability
      const timer = setTimeout(() => { fetchProxyImage(src); }, 0);
      return () => clearTimeout(timer);
    } else {
      // 直接使用原始URL
      setProxySrc(src);
      setLoading(false);
    }
  }, [src]);

  const fetchProxyImage = async (url: string) => {
    try {
      const response = await fetch('/api/proxy-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setProxySrc(blobUrl);
      } else {
        console.error('Proxy image failed:', response.status);
        setError(true);
      }
    } catch (err) {
      console.error('Proxy image error:', err);
      // 如果代理失败，尝试直接使用原始URL
      setProxySrc(url);
    } finally {
      setLoading(false);
    }
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  const handleImageError = () => {
    setLoading(false);
    setError(true);
  };

  // 没有图片源
  if (!src && !proxySrc) {
    if (fallback) return <>{fallback}</>;
    if (!showPlaceholder) return null;

    return (
      <div className={cn('flex items-center justify-center bg-[var(--bg-tertiary)] border-2 border-dashed border-[var(--border-color)]', className)}>
        <div className="text-center p-4">
          <ImageIcon className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-2" />
          <p className="text-xs text-[var(--text-muted)]">暂无图片</p>
        </div>
      </div>
    );
  }

  // 加载中
  if (loading) {
    return (
      <div className={cn('flex items-center justify-center bg-[var(--bg-tertiary)]', className)}>
        <Loader2 className="w-8 h-8 text-[var(--gold)] animate-spin" />
      </div>
    );
  }

  // 加载错误
  if (error) {
    if (fallback) return <>{fallback}</>;
    if (!showPlaceholder) return null;

    return (
      <div className={cn('flex items-center justify-center bg-[var(--bg-tertiary)] border border-[var(--accent-red)]/30 rounded-lg', className)}>
        <div className="text-center p-4">
          <AlertCircle className="w-8 h-8 mx-auto text-[var(--accent-red)] mb-2" />
          <p className="text-xs text-[var(--accent-red)]">图片加载失败</p>
          {src && (
            <a 
              href={src} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-[var(--gold)] hover:underline mt-2 inline-block"
            >
              在新窗口打开
            </a>
          )}
        </div>
      </div>
    );
  }

  // 正常显示
  return (
    <Image
      src={proxySrc || src || ''}
      alt={alt}
      className={className}
      onLoad={handleImageLoad as any}
      onError={handleImageError as any}
      unoptimized
    />
  );
}
