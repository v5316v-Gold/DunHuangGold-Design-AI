/**
 * API设置配置
 * 包含云端API、本地ComfyUI、本地大模型的配置结构
 */

// ==================== 云端API连接 ====================

// 云端API凭证（连接池）
export interface CloudConnection {
  id: string;                      // 连接唯一ID，如 'openai-main', 'zhipu-backup'
  name: string;                    // 显示名称，如 'OpenAI 主账号'
  provider: CloudProvider;          // 提供商
  apiKey: string;                  // API密钥
  endpoint: string;                // API地址
  model?: string;                 // 默认模型（可选）
  enabled: boolean;               // 是否启用
  isDefault: boolean;              // 是否默认
  timeout: number;                // 超时(ms)
  testResult?: 'success' | 'failed' | 'unknown';
  lastTested?: string;
  error?: string;
}

// 获取默认连接配置
export function getDefaultCloudConnection(provider: CloudProvider = 'minimax'): Partial<CloudConnection> {
  // 防御：provider 不在注册表中时 fallback minimax
  const info = CLOUD_PROVIDERS[provider] || CLOUD_PROVIDERS.minimax;
  return {
    provider: CLOUD_PROVIDERS[provider] ? provider : 'minimax',
    apiKey: '',
    endpoint: info.defaultEndpoint,
    model: info.defaultModel,
    timeout: 60000,
    enabled: false,
    isDefault: false,
  };
}

// ==================== 云端API功能配置 ====================

// 云端API配置（功能级）
export interface CloudApiConfig {
  id: string;
  enabled: boolean;
  connectionId?: string;  // 绑定到的连接ID
  provider: CloudProvider;
  apiKey: string;
  endpoint: string;
  model: string;
  timeout: number;
  cost: number;
  testResult?: 'success' | 'failed' | 'unknown';
  lastTested?: string;
  error?: string;
}

export type CloudProvider = 'minimax' | 'deepseek';

export const CLOUD_PROVIDERS: Record<CloudProvider, { name: string; defaultEndpoint: string; defaultModel: string }> = {
  'minimax': {
    name: 'MiniMax',
    defaultEndpoint: 'https://api.minimax.chat/v1',
    defaultModel: 'image-01',
  },
  'deepseek': {
    name: 'DeepSeek',
    defaultEndpoint: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
};

// ==================== 本地ComfyUI配置 ====================

export interface ComfyUIConfig {
  id: string;
  enabled: boolean;
  workflowId: string;
  nodeMapping?: ComfyUINodeMapping;
  defaultParams?: ComfyUIDefaultParams;
  model?: string;
  testResult?: 'success' | 'failed' | 'unknown';
  lastTested?: string;
  error?: string;
}

export interface ComfyUINodeMapping {
  prompt?: string;
  negativePrompt?: string;
  image?: string;
  width?: string;
  height?: string;
  model?: string;
  seed?: string;
  steps?: string;
  cfg?: string;
  sampler?: string;
  outputImage?: string;
}

export interface ComfyUIDefaultParams {
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  denoise?: number;
  batchSize?: number;
}

// ==================== 本地大模型配置 ====================

export interface LocalLLMConfig {
  id: string;  // 固定为 'ai-chat'
  enabled: boolean;
  provider: LLMProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeout: number;
  stream: boolean;
  testResult?: 'success' | 'failed' | 'unknown';
  lastTested?: string;
  error?: string;
}

export type LLMProvider = 'ollama' | 'lmstudio' | 'vllm' | 'custom';

export const LLM_PROVIDERS: Record<LLMProvider, { name: string; defaultUrl: string }> = {
  'ollama': {
    name: 'Ollama',
    defaultUrl: 'http://127.0.0.1:11434',
  },
  'lmstudio': {
    name: 'LM Studio',
    defaultUrl: 'http://127.0.0.1:1234',
  },
  'vllm': {
    name: 'vLLM',
    defaultUrl: 'http://127.0.0.1:8000',
  },
  'custom': {
    name: '自定义',
    defaultUrl: 'http://127.0.0.1:8000',
  },
};

// ==================== 默认配置 ===================

import { FEATURE_DEFINITIONS } from './features';

// 获取功能的默认云端配置
export function getDefaultCloudConfig(featureId: string): Partial<CloudApiConfig> {
  const feature = FEATURE_DEFINITIONS[featureId];
  const provider = (feature?.defaultCloudProvider as CloudProvider) || 'minimax';
  // 防御：provider 不在注册表中时 fallback minimax（避免删 provider 后整链崩）
  const providerInfo = CLOUD_PROVIDERS[provider] || CLOUD_PROVIDERS.minimax;
  
  return {
    provider: CLOUD_PROVIDERS[provider] ? provider : 'minimax',
    endpoint: providerInfo.defaultEndpoint,
    model: providerInfo.defaultModel,
    timeout: 60000,
    cost: 10,
    enabled: false,
    apiKey: "",
  };
}

// 获取功能的默认ComfyUI配置
export function getDefaultComfyUIConfig(featureId: string): Partial<ComfyUIConfig> {
  return {
    enabled: false,
    workflowId: '',
    model: '',
  };
}

// 获取默认的大模型配置
export function getDefaultLocalLLMConfig(): Partial<LocalLLMConfig> {
  return {
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen2.5:7b',
    timeout: 120000,
    stream: true,
    enabled: false,
  };
}
