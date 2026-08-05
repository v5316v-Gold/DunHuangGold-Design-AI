/**
 * 认证 Hook
 * 管理用户登录状态
 *
 * 安全修复（P0-1）：
 * - JWT 不再写入 localStorage（XSS 可窃取风险）
 * - 仅通过 HttpOnly cookie（auth_token）携带，浏览器自动随请求发送
 * - 会话恢复改为调 /api/auth/me 校验（不再信任 localStorage 的用户快照）
 */

import { useState, useEffect, useCallback } from 'react';

// localStorage 仅缓存用户资料（非敏感信息），token 绝不下放
const USER_KEY = 'dunhuang_user';

export interface User {
  id: string;
  email: string;
  nickname?: string;
  avatar?: string;
  role: string;
  power: number;
  status: string;
}

interface UseAuthReturn {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    nickname?: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updatePower: (power: number) => void;
  updateAvatar: (avatar: string) => void;
}

export function useAuth(): UseAuthReturn {
  // SSR 首帧始终为未登录，避免 hydration mismatch；
  // 挂载后 useEffect 调 /api/auth/me 恢复会话（由 HttpOnly cookie 认证）。
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 客户端挂载后恢复登录态（SSR 时 window 不存在，此 effect 不执行）
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await response.json();
        if (data.success) {
          setUser(data.data);
          // 用户资料写入 localStorage 便于快速渲染（不含 token）
          localStorage.setItem(USER_KEY, JSON.stringify(data.data));
        } else {
          // 未登录，清理残留
          localStorage.removeItem(USER_KEY);
        }
      } catch {
        // 网络错误：静默降级为未登录
        localStorage.removeItem(USER_KEY);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // 登录
  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // 必须携带/接收 cookie
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.data.user);
        // token 由 HttpOnly cookie 管理，前端不持有
        localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));
        return { success: true };
      } else {
        return { success: false, error: data.error || '登录失败' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败';
      return { success: false, error: errorMessage };
    }
  }, []);

  // 注册
  const register = useCallback(async (email: string, password: string, nickname?: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, nickname }),
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));
        return { success: true };
      } else {
        return { success: false, error: data.error || '注册失败' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '注册失败';
      return { success: false, error: errorMessage };
    }
  }, []);

  // 登出
  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(USER_KEY);
    // 通知后端清除 HttpOnly cookie
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // 忽略登出请求失败（本地状态已清）
    }
  }, []);

  // 刷新用户信息
  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await response.json();
      if (data.success) {
        setUser(data.data);
        localStorage.setItem(USER_KEY, JSON.stringify(data.data));
      } else {
        // Token 无效，登出
        logout();
      }
    } catch (error) {
      console.error('刷新用户信息失败:', error);
    }
  }, [logout]);

  // 更新算力（本地）
  const updatePower = useCallback(
    (power: number) => {
      setUser((prev) => (prev ? { ...prev, power } : null));
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify({ ...user, power }));
      }
    },
    [user]
  );

  // 更新头像
  const updateAvatar = useCallback((avatar: string) => {
    setUser((prev) => (prev ? { ...prev, avatar } : null));
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      localStorage.setItem(USER_KEY, JSON.stringify({ ...parsed, avatar }));
    }
  }, []);

  return {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
    updatePower,
    updateAvatar,
  };
}

// 获取 Authorization header
// 安全修复：token 在 HttpOnly cookie 中，前端不再从 localStorage 读取。
// fetch 时用 credentials: 'include' 即可自动携带。
// 保留此函数返回空对象，避免破坏现有调用点（如 admin 页面）的兼容性。
export function getAuthHeader(): Record<string, string> {
  return {};
}
