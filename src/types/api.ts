/**
 * 统一 API 类型定义
 * 
 * 所有 API 相关类型都集中在这里
 */

// 提供商类型
export type ImageProvider = 'openai' | 'stability' | 'doubao' | 'zhipu' | 'qwen' | 'kimi' | 'minimax' | 'custom';
export type LLMProvider = 'zhipu' | 'doubao' | 'openai' | 'ollama' | 'qwen' | 'kimi' | 'minimax' | 'custom';
export type VideoProvider = 'zhipu' | 'runway' | 'pika' | 'sora' | 'qwen' | 'kimi' | 'minimax' | 'custom';
export type ModelingProvider = 'tripo' | 'meshy' | 'kaedim' | 'custom';

// 服务提供商（联合类型）
export type ServiceProvider = ImageProvider | LLMProvider | VideoProvider | ModelingProvider;

// API 类别
export type ApiCategory = 'llm' | 'image-generate' | 'image-edit' | '3d-modeling' | 'video-generate';

// 算力来源
export type PowerSource = 'cloud' | 'local';

// 运行时 API 配置（前端使用）
export interface RuntimeApiConfig {
  id: string;
  name: string;
  category: ApiCategory;
  enabled: boolean;
  source: PowerSource;
  cloud: {
    apiKey?: string;
    provider?: ServiceProvider;
    model?: string;
    url?: string;
    timeout?: number;
  };
  local: {
    service?: {
      type: 'comfyui' | 'ollama' | 'webui' | 'custom';
      host: string;
      port: number;
      workflowId?: string;
    };
    testResult?: string;
  };
  lastTested?: string;
}

// 功能模块映射
export interface FeatureConfig {
  id: string;
  name: string;
  group: string;
  apiId: string;
  cost: number;
  description: string;
  supportsAIAssistant?: boolean;
}

// 功能状态
export interface FeatureStatus {
  id: string;
  name: string;
  group: string;
  enabled: boolean;
  apiId: string;
  cost: number;
  supportsAIAssistant: boolean;
}

// API 映射
export interface ApiMapping {
  configs: Record<string, RuntimeApiConfig>;
  features: FeatureConfig[];
  globalSource: PowerSource;
}

// ==================== 通用类型 ====================

// API 调用选项
export interface ApiCallOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

// API 响应
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// JWT 载荷
export interface JwtPayload {
  userId: string;
  username: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

// ComfyUI 响应
export interface ComfyUIResponse {
  success: boolean;
  prompt_id?: string;
  images?: string[];
  error?: string;
}

// 日志级别
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

// API 错误
export interface ApiError extends Error {
  status?: number;
  code?: string;
}

// 数据库错误
export interface DatabaseError extends Error {
  code?: string;
  detail?: string;
}

// 性能指标
export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// 健康检查结果
export interface HealthCheckResult {
  healthy: boolean;
  service: string;
  message?: string;
  timestamp: number;
}

// 速率限制 - 允许
export interface RateLimitAllowed {
  allowed: true;
  remaining: number;
  resetAt: number;
}

// 速率限制 - 阻止
export interface RateLimitBlocked {
  allowed: false;
  retryAfter: number;
}

// 速率限制结果
export type RateLimitResult = RateLimitAllowed | RateLimitBlocked | null;

// 工作流信息
export interface WorkflowInfo {
  id: string;
  name: string;
  description?: string;
  version?: string;
  lastModified?: string;
}
