/**
 * 客户端认证工具函数
 * 从 localStorage 读取 token，生成 Authorization header
 * 不依赖 React，适合在 service 层使用
 */

const TOKEN_KEY = 'dunhuang_token';

/**
 * 获取 Authorization header
 * 仅在浏览器环境有效
 */
export function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * 检查是否已登录
 */
export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}
