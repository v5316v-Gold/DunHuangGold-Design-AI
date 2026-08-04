/**
 * 认证 Hook
 * 管理用户登录状态
 */

import { useState, useEffect, useCallback } from 'react';

const TOKEN_KEY = 'dunhuang_token';
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
  // 挂载后 useEffect 再从 localStorage 恢复会话。
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 客户端挂载后恢复登录态（SSR 时 window 不存在，此 effect 不执行）
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    let restoredUser: User | null = null;
    if (savedUser) {
      try {
        restoredUser = JSON.parse(savedUser);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setUser(restoredUser);
    setToken(savedToken);
    setIsLoading(false);
  }, []);

  // 登录
  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        setToken(data.data.token);
        setUser(data.data.user);
        localStorage.setItem(TOKEN_KEY, data.data.token);
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
        body: JSON.stringify({ email, password, nickname }),
      });

      const data = await response.json();

      if (data.success) {
        setToken(data.data.token);
        setUser(data.data.user);
        localStorage.setItem(TOKEN_KEY, data.data.token);
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
  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  // 刷新用户信息
  const refreshUser = useCallback(async () => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (!savedToken) return;

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      });

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
export function getAuthHeader(): Record<string, string> {
  // SSR 预渲染（如 _not-found、静态生成）时无 localStorage，必须守卫
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
