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
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        // 兼容两种响应结构：
        //   - 标准 envelope: { success, data: { id, email, role, ... } }
        //   - 旧格式:       { data: { user: ... } } 或 { user: ... }
        const u = d?.data?.user ?? d?.user ?? d?.data ?? null;
        if (u && (u.id || u.email)) {
          setUser({
            id: u.id,
            email: u.email,
            role: u.role,
            nickname: u.nickname,
            avatar: u.avatar,
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
