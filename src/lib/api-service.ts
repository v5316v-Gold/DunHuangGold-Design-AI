/**
 * 统一 API 调用服务 - 简化版
 * 
 * 基于功能模块调用对应的API
 * API Key 只存储在后端，更安全
 */

import {
  coreApiConfigs,
  featureConfigs,
  getFeatureConfig as getFeatureApiConfig,
  getFeatureCost,
  PowerSource
} from './api-config-client';
import { fetchSSEJson } from './sse-utils';
import { getAuthHeader } from './auth-client';

// API 调用选项
export interface ApiCallOptions {
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
  forceSource?: PowerSource;
}

// API 响应
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fromMock?: boolean;
  source?: PowerSource;
}

// 功能ID别名映射（兼容旧ID -> 新ID）
const featureIdAliases: Record<string, string> = {
  // 图片生成类别名
  'generate-image': 'text2img',
  'product-refine': 'refine',
  'multi-image': 'blend',
  'one-click-design': 'oneclick',
  'multi-view': 'multiview',
  'sketch-realistic': 'sketch',
  'free-creation': 'free',
  'try-on': 'tryon',
  'tryon-effect': 'tryon',

  // 3D建模类别名
  'image-3d': 'image3d',
  'stereo': '2dto3d',
  'relief-design': 'relief',
  
  // 图片编辑类别名
  'remove-background': 'removebg',
  'remove-watermark': 'watermark',
  'upscale-image': 'upscale',
  
  // 视频生成类别名
  'text-to-video': 'text2video',
  'image-to-video': 'img2video',
  
  // LLM对话类别名
  'chat': 'dialogue',
  'llm-chat': 'dialogue',
  
  // 视频生成类别名（通用映射到text2video，实际由API路由区分）
  'video-generate': 'text2video',
};

// 功能ID到API路径的映射
const featureApiPathMap: Record<string, string> = {
  // LLM对话类
  'dialogue': '/api/chat',
  
  // 图片生成类
  'text2img': '/api/generate-image',
  'refine': '/api/product-refine',
  'blend': '/api/multi-image',
  'oneclick': '/api/one-click-design',
  'multiview': '/api/multi-view',
  'sketch': '/api/sketch-realistic',
  'free': '/api/free-creation',
  
  // 图片编辑类
  'relief': '/api/relief',
  'image3d': '/api/image-3d',
  '2dto3d': '/api/stereo',
  'removebg': '/api/remove-background',
  'upscale': '/api/upscale',
  'watermark': '/api/remove-watermark',
  
  // 视频生成类
  'text2video': '/api/video',
  'img2video': '/api/video',

  // 佩戴效果 (2026-08-03 闭环:独立 API 路由,避免与 image-generate 互窜)
  'tryon': '/api/tryon',
};

/**
 * 解析功能ID（处理别名）
 */
function resolveFeatureId(featureId: string): string {
  // 如果是别名，转换为正式ID
  if (featureIdAliases[featureId]) {
    return featureIdAliases[featureId];
  }
  // 如果已经是正式ID，直接返回
  if (featureConfigs.some(f => f.id === featureId)) {
    return featureId;
  }
  // 未知ID，尝试返回原值（向后兼容）
  return featureId;
}

// 可重试的错误状态码
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * 带重试的 fetch（指数退避）
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  baseDelayMs: number = 500,
  timeoutMs: number = 60000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 成功或不可重试的状态码，直接返回
      if (response.ok || !RETRYABLE_STATUS_CODES.has(response.status)) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // AbortError 不重试
      if (lastError.name === 'AbortError') {
        throw lastError;
      }
    }

    // 非最后一次，等待后重试
    if (attempt < maxRetries) {
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('请求失败');
}

/**
 * 统一 API 调用函数
 * 
 * @param featureId 功能模块ID（如 'text2img', 'dialogue' 或旧别名如 'generate-image'）
 * @param options 调用选项
 * 
 * @example
 * const response = await callApi('text2img', {
 *   params: { prompt: '一只可爱的猫', width: 512, height: 512 }
 * });
 */
export async function callApi<T = unknown>(
  featureId: string,
  options: ApiCallOptions = {}
): Promise<ApiResponse<T>> {
  // 解析功能ID（处理别名）
  const resolvedFeatureId = resolveFeatureId(featureId);
  
  // 获取功能配置
  const featureConfig = featureConfigs.find(f => f.id === resolvedFeatureId);
  if (!featureConfig) {
    return { success: false, error: `功能不存在: ${featureId} (解析为: ${resolvedFeatureId})` };
  }

  // 获取API配置
  const apiConfig = coreApiConfigs[featureConfig.apiId];
  if (!apiConfig) {
    return { success: false, error: `API配置不存在: ${featureConfig.apiId}` };
  }

  // 获取API路径（使用解析后的ID查找）
  const apiPath = featureApiPathMap[resolvedFeatureId] || featureApiPathMap[featureId] || `/api/${featureId}`;
  const source = options.forceSource || apiConfig.source || 'cloud';

  try {
    // 3D 生成类接口需要更长超时（5分钟）
    const isLongTimeoutFeature = ['relief', 'image-3d', 'image3d', 'stereo', '2dto3d', 'relief-design'].includes(resolvedFeatureId);
    const timeout = options.timeout ?? (isLongTimeoutFeature ? 300000 : 60000);

    const response = await fetchWithRetry(apiPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...options.headers,
      },
      body: JSON.stringify({
        ...options.params,
        _feature: featureId,
        _source: source,
      }),
    }, 3, 500, timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    // 检查响应结构
    const isSuccess = result.success ?? response.ok;
    
    if (isSuccess) {
      return {
        success: true,
        data: result.data ?? result,
        source,
      };
    } else {
      return {
        success: false,
        error: result.error || '请求失败',
        source,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error
        ? (error.name === 'AbortError' ? '请求已取消或超时' : error.message)
        : '请求失败',
      source,
    };
  }
}

/**
 * 流式 API 调用（用于 AI 对话）
 * 
 * @example
 * for await (const chunk of streamApi('dialogue', {
 *   params: { messages: [{ role: 'user', content: '你好' }] }
 * })) {
 *   console.log(chunk);
 * }
 */
export async function* streamApi(
  featureId: string,
  options: ApiCallOptions = {}
): AsyncGenerator<string, void, unknown> {
  // 解析功能ID（处理别名）
  const resolvedFeatureId = resolveFeatureId(featureId);
  
  const featureConfig = featureConfigs.find(f => f.id === resolvedFeatureId);
  if (!featureConfig) {
    throw new Error(`功能不存在: ${featureId} (解析为: ${resolvedFeatureId})`);
  }

  const apiConfig = coreApiConfigs[featureConfig.apiId];
  if (!apiConfig) {
    throw new Error(`API配置不存在: ${featureConfig.apiId}`);
  }

  const apiPath = featureApiPathMap[resolvedFeatureId] || featureApiPathMap[featureId] || `/api/${featureId}`;
  const source = options.forceSource || apiConfig.source || 'cloud';

  // 对于对话功能，自动从 localStorage 读取 API Key
  const headers = { ...getAuthHeader(), ...options.headers };
  if (resolvedFeatureId === 'dialogue' || resolvedFeatureId === 'chat' || featureId === 'chat') {
    try {
      const savedConfig = localStorage.getItem('ai-assistant-config');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        if (config.apiKey) {
          headers['x-api-key'] = config.apiKey;
        }
      }
    } catch (e) {
      // 忽略 localStorage 读取错误
    }
  }

  const response = await fetch(apiPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      ...options.params,
      _feature: featureId,
      _source: source,
    }),
  });

  // 使用 SSE 工具函数处理流式响应
  for await (const obj of fetchSSEJson<{ content?: string }>(response)) {
    if (obj.content) {
      yield obj.content;
    }
  }
}

// 导出辅助函数
export { getFeatureCost, getFeatureApiConfig };
