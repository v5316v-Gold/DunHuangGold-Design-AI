/**
 * Phase 9.26 · 统一 API 客户端
 *
 * 目标：集中管理所有 API 调用，消除散落 30+ 文件的裸 fetch。
 * 特性：
 *   - 路径常量 API_ROUTES（单一真源）
 *   - 统一 fetch wrapper（auth header / 重试 / 错误 envelope）
 *   - 类型定义 APIResponse<T>
 *   - JSON 响应自动解析 + envelope 校验
 *
 * 用法：
 *   import { apiClient, API_ROUTES } from '@/lib/api-client';
 *   const res = await apiClient.post(API_ROUTES.generateAsync, { featureId, params });
 *   if (res.success) { res.data.taskId }
 */

// ==================== 路径常量 ====================

export const API_ROUTES = {
  // 认证
  login: '/api/auth/login',
  register: '/api/auth/register',
  logout: '/api/auth/logout',
  me: '/api/auth/me',

  // AI 生成（统一入口）
  generateAsync: '/api/ai/generate-async',
  generateSync: '/api/ai/generate',

  // AI 对话
  chat: '/api/chat',

  // 任务
  task: (id: string) => `/api/tasks/${id}`,

  // 功能
  features: '/api/features',
  featureCosts: '/api/feature-costs',
  v1Features: '/api/v1/features',

  // 健康
  health: '/api/health',
  ping: '/api/ping',

  // 用户
  userProfile: '/api/user/profile',
  userAvatar: '/api/user/avatar',
  userPassword: '/api/user/password',
  userSettings: '/api/user/settings',

  // 资源
  power: '/api/power',
  models: '/api/models',
  favorites: '/api/favorites',
  download: '/api/download',
  works: '/api/works',
  promptOptimize: '/api/prompt-optimize',
  translate: '/api/translate',
  tryon: '/api/tryon',
  proxyImage: '/api/proxy-image',
  proxyModel: '/api/proxy-model',
  operationLogs: '/api/operation-logs',
  performanceMetrics: '/api/performance/metrics',
  stats: '/api/stats',

  // ComfyUI
  comfyui: '/api/comfyui',
  comfyuiCall: '/api/comfyui/call',
  comfyuiExecute: '/api/comfyui/execute',
  comfyuiProgress: '/api/comfyui/progress',
  comfyuiPrompt: '/api/comfyui/prompt',
  comfyuiStatus: '/api/comfyui/status',
  comfyuiImage: '/api/comfyui-image',

  // 设置
  settingsCloud: '/api/settings/cloud',
  settingsComfyUI: '/api/settings/comfyui',
  settingsLLM: '/api/settings/llm',

  // 管理后台
  adminModelRegistry: '/api/admin/model-registry',
  adminModelRegistryItem: (id: string) => `/api/admin/model-registry/${id}`,
} as const;

// ==================== 类型定义 ====================

/** 统一响应 envelope（对齐后端 lib/api-response.ts） */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  requestId?: string;
  details?: unknown;
}

/** 请求选项 */
export interface ApiClientOptions {
  /** 额外 headers */
  headers?: Record<string, string>;
  /** 超时（ms，默认 60000） */
  timeoutMs?: number;
  /** 重试次数（默认 2，仅 5xx/429 重试） */
  retries?: number;
  /** 是否带 auth header（默认 true） */
  auth?: boolean;
  /** 是否携带 cookie（credentials: 'include'，默认 false） */
  withCredentials?: boolean;
  /** AbortSignal */
  signal?: AbortSignal;
}

/** 可重试状态码 */
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

// ==================== 认证 ====================

const TOKEN_KEY = 'dunhuang_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      localStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem('auth_token') ||
      null
    );
  } catch {
    return null;
  }
}

// ==================== fetch wrapper ====================

async function request<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
  options: ApiClientOptions = {}
): Promise<APIResponse<T>> {
  const {
    headers: extraHeaders = {},
    timeoutMs = 60000,
    retries = 2,
    auth = true,
    withCredentials = false,
    signal,
  } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const mergedSignal = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: mergedSignal,
        ...(withCredentials ? { credentials: 'include' as const } : {}),
      });

      // 解析响应（兼容 envelope / 裸数据）
      const text = await response.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      // 成功
      if (response.ok) {
        // 已是 envelope
        if (json && typeof json === 'object' && 'success' in (json as Record<string, unknown>)) {
          return json as APIResponse<T>;
        }
        // 裸数据包装
        return { success: true, data: json as T };
      }

      // 可重试状态码
      if (RETRYABLE.has(response.status) && attempt < retries) {
        const delay = 500 * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // 错误响应（envelope 或裸错误）
      if (json && typeof json === 'object' && 'success' in (json as Record<string, unknown>)) {
        return json as APIResponse<T>;
      }
      return {
        success: false,
        error: `HTTP ${response.status}`,
        code: String(response.status),
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === 'AbortError') {
        return { success: false, error: '请求超时或已取消', code: 'TIMEOUT' };
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || '请求失败',
    code: 'NETWORK_ERROR',
  };
}

// ==================== 导出统一客户端 ====================

export const apiClient = {
  get: <T = unknown>(url: string, options?: ApiClientOptions) =>
    request<T>('GET', url, undefined, options),
  post: <T = unknown>(url: string, body?: unknown, options?: ApiClientOptions) =>
    request<T>('POST', url, body, options),
  put: <T = unknown>(url: string, body?: unknown, options?: ApiClientOptions) =>
    request<T>('PUT', url, body, options),
  patch: <T = unknown>(url: string, body?: unknown, options?: ApiClientOptions) =>
    request<T>('PATCH', url, body, options),
  delete: <T = unknown>(url: string, options?: ApiClientOptions) =>
    request<T>('DELETE', url, undefined, options),
};

export { getToken };