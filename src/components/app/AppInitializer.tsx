'use client';

import { useEffect } from 'react';
import { preloadFeatureCosts } from '@/lib/power';

export default function AppInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 预加载功能算力配置
    preloadFeatureCosts();
  }, []);

  return <>{children}</>;
}
