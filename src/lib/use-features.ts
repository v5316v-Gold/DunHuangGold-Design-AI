'use client';
import { useEffect, useState } from 'react';
import { apiClient, API_ROUTES } from '@/lib/api-client';

/** 公开功能元数据（来自 /api/features，脱敏字段） */
export interface PublicFeature {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  order?: number;
  sortOrder?: number;
  /** 启用开关（管理员可在后台实时切换） */
  enabled?: boolean;
}

/** 从 /api/features 加载启用的功能列表（Sidebar / WorkspacePanel 共用） */
export function useFeatures() {
  const [features, setFeatures] = useState<PublicFeature[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiClient.get<{ features: Array<{ id: string; name: string }> }>(API_ROUTES.features)
      .then((d) => setFeatures(d.data?.features ?? []))
      .catch(() => setFeatures([]))
      .finally(() => setLoading(false));
  }, []);
  return { features, loading };
}
