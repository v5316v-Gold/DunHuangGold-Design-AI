import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';

interface UseLazyLoadOptions {
  root?: Element | null;      // 根元素，默认 viewport
  rootMargin?: string;         // 根元素边距，默认 '0px'
  threshold?: number | number[]; // 触发阈值，默认 0
  placeholder?: string;        // 占位图 URL
  blur?: boolean;              // 是否启用模糊过渡，默认 true
}

interface UseLazyLoadReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  isVisible: boolean;
  isLoaded: boolean;
  error: boolean;
  load: () => void;            // 手动触发加载
  unload: () => void;          // 卸载图片
}

/**
 * 图片懒加载 Hook
 * 
 * 功能：
 * - IntersectionObserver 监听可见性
 * - 占位图支持
 * - 模糊过渡动画
 * - 错误处理
 * - 手动加载控制
 * 
 * @example
 * ```tsx
 * function HistoryList({ items }) {
 *   return (
 *     <div>
 *       {items.map((item) => (
 *         <LazyImage
 *           key={item.id}
 *           src={item.imageUrl}
 *           alt="生成结果"
 *           placeholder="/placeholder.jpg"
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * 
 * // 或使用 Hook
 * function LazyImage({ src, alt, placeholder }) {
 *   const { ref, isLoaded, error } = useLazyLoad({ 
 *     placeholder,
 *     blur: true 
 *   });
 * 
 *   return (
 *     <div ref={ref} className="image-container">
 *       {!isLoaded && <div className="placeholder" />}
 *       {error && <div className="error">加载失败</div>}
 *       <img
 *         src={src}
 *         alt={alt}
 *         className={cn('image', isLoaded && 'loaded')}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useLazyLoad(options: UseLazyLoadOptions = {}): UseLazyLoadReturn {
  const {
    root = null,
    rootMargin = '0px',
    threshold = 0,
    blur = true,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  const observerRef = useRef<IntersectionObserver | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  /**
   * 手动触发加载
   */
  const load = useCallback(() => {
    if (!ref.current) return;
    
    const img = ref.current.querySelector('img');
    if (!img) return;

    imageRef.current = img;
    setIsVisible(true);

    if (img.complete) {
      setIsLoaded(true);
      return;
    }

    img.onload = () => {
      setIsLoaded(true);
      setError(false);
    };

    img.onerror = () => {
      setError(true);
      setIsLoaded(false);
    };

    // 如果 src 是空，触发加载
    if (!img.src && img.dataset.src) {
      img.src = img.dataset.src;
    }
  }, []);

  /**
   * 卸载图片
   */
  const unload = useCallback(() => {
    setIsVisible(false);
    setIsLoaded(false);
    setError(false);
    
    if (imageRef.current) {
      imageRef.current.src = '';
    }
  }, []);

  useEffect(() => {
    if (!ref.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsVisible(true);
          load();
          // 加载后停止观察
          if (observerRef.current) {
            observerRef.current.unobserve(entry.target);
          }
        }
      },
      { root, rootMargin, threshold }
    );

    observerRef.current.observe(ref.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [root, rootMargin, threshold, load]);

  return {
    ref,
    isVisible,
    isLoaded,
    error,
    load,
    unload,
  };
}

/**
 * 懒加载图片组件
 */
export function LazyImage({
  src,
  alt,
  width,
  height,
  placeholder,
  className,
  blur = true,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  placeholder?: string;
  blur?: boolean;
}) {
  const { ref, isLoaded, error } = useLazyLoad({ placeholder, blur });

  return (
    <div ref={ref} className={`lazy-image-container ${className || ''}`}>
      {!isLoaded && !error && placeholder && (
        <Image src={placeholder} alt="图片加载占位符" className="lazy-image-placeholder" width={400} height={300} unoptimized />
      )}
      {error && <div className="lazy-image-error">加载失败</div>}
      <Image
        src={(src as string) || ''}
        alt={(alt as string) || ''}
        data-src={src}
        className={`lazy-image ${isLoaded ? 'loaded' : ''}`}
        width={typeof width === 'number' ? width : 400}
        height={typeof height === 'number' ? height : 300}
        unoptimized
        {...props}
      />
      <style jsx>{`
        .lazy-image-container {
          position: relative;
          overflow: hidden;
        }
        .lazy-image-placeholder,
        .lazy-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .lazy-image {
          position: absolute;
          top: 0;
          left: 0;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
        }
        ${blur ? `
        .lazy-image:not(.loaded) {
          filter: blur(10px);
        }
        ` : ''}
        .lazy-image.loaded {
          opacity: 1;
        }
        .lazy-image-error {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #ef4444;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
