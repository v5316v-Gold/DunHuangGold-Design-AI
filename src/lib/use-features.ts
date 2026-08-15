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

/** 当前登录用户（含角色，用于 Sidebar 管理入口判断） */
export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  nickname?: string;
  avatar?: string;
}

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    let cancelled = false;
    // 1) 优先从 cookie 快速读出（cookie 由 middleware 写入，httpOnly 但 role 已在 JWT 中）
    // 2) 调 /api/auth/me 取完整信息（含 nickname/avatar/power）
    apiClient.get<Record<string, unknown>>(API_ROUTES.me, { withCredentials: true, auth: false })
      .then((d) => (d.success ? d.data : null))
      .then((d) => {
        if (cancelled) return;
        // 兼容两种响应结构：
        //   - 标准 envelope: { success, data: { id, email, role, ... } }
        //   - 旧格式:       { data: { user: ... } } 或 { user: ... }
        const d2 = d?.data as Record<string, unknown> | undefined;
        const u = (d2?.user as Record<string, unknown> | undefined) ?? (d as unknown as Record<string, unknown>) ?? d2 ?? null;
        if (u && (u.id as string | undefined) && (u.email as string | undefined)) {
          setUser({
            id: String(u.id),
            email: String(u.email),
            role: String(u.role ?? 'user'),
            nickname: u.nickname ? String(u.nickname) : undefined,
            avatar: u.avatar ? String(u.avatar) : undefined,
          });
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return user;
}
