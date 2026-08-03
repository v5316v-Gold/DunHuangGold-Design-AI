'use client';
import { useEffect, useState } from 'react';

/** 公开功能元数据（来自 /api/features，脱敏字段） */
export interface PublicFeature {
  id: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  order?: number;
  /** 启用开关（管理员可在后台实时切换） */
  enabled?: boolean;
}

/** 从 /api/features 加载启用的功能列表（Sidebar / WorkspacePanel 共用） */
export function useFeatures() {
  const [features, setFeatures] = useState<PublicFeature[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/features')
      .then((r) => r.json())
      .then((d) => setFeatures(d.data?.features || []))
      .catch(() => setFeatures([]))
      .finally(() => setLoading(false));
  }, []);
  return { features, loading };
}

/** 当前登录用户（含角色，用于 Sidebar 管理入口判断） */
export function useCurrentUser() {
  const [user, setUser] = useState<{ id: string; email: string; role: string } | null>(null);
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d?.data?.user || d?.user || null))
      .catch(() => setUser(null));
  }, []);
  return user;
}
