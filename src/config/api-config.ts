/**
 * 统一 API 配置 — 所有层共享的类型和常量
 *
 * 职责：
 * - 类型定义（ImageProvider, VideoProvider, ApiConfig）
 * - 静态常量（coreApiConfigs, PROVIDER_ENDPOINTS, VIDEO_PROVIDER_ENDPOINTS）
 * - 功能映射（FEATURE_API_MAP, FEATURE_COSTS）
 *
 * 使用方式：
 * - Server: 本文件 + api-config-service.ts（提供 DB 读写、缓存）
 * - Client: 本文件（无 DB 依赖，纯静态）
 */

// ==================== 类型定义 ====================

export type PowerSource = 'cloud' | 'local';

export type ApiCategory = 'llm' | 'image-generate' | 'image-edit' | '3d-modeling' | 'video-generate';

export type ImageProvider = 'openai' | 'zhipu' | 'qwen' | 'kimi' | 'minimax' | 'meshy' | 'custom';

export type VideoProvider = 'zhipu' | 'runway' | 'pika' | 'sora' | 'qwen' | 'kimi' | 'minimax' | 'custom';

// ==================== API 配置接口 ====================

export interface ApiConfig {
  id: string;
  name: string;
  apiKey: string | null;
  provider: ImageProvider;
  model: string | null;
  url: string | null;
  enabled: boolean;
  timeout: number;
}

// 核心 API 配置（5大类别）
export interface CoreApiConfig {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  source: PowerSource;
  cloud: {
    apiKey: string;
    provider?: string;
    model?: string;
    url?: string;
    timeout?: number;
  };
  local: {
    apiKey: string;
    provider?: string;
    model?: string;
    timeout?: number;
    service?: {
      type: string;
      host: string;
      port: number;
      workflowId?: string;
    };
  };
  lastTested?: string;
  cloudTestResult?: 'success' | 'failed' | 'unknown';
  localTestResult?: 'success' | 'failed' | 'unknown';
}

// 功能配置
export interface FeatureConfig {
  id: string;
  name: string;
  group: string;
  apiId: string;
  cost: number;
  description: string;
  supportsAIAssistant?: boolean;
}

// ==================== 核心 API 配置 ====================

export const coreApiConfigs: Record<string, CoreApiConfig> = {
  'llm-chat': {
    id: 'llm-chat',
    name: 'LLM对话',
    category: 'llm',
    description: '大语言模型对话，支持流式输出',
    enabled: true,
    source: 'cloud',
    cloud: {
      apiKey: '',
      provider: 'zhipu',
      model: 'glm-4-7-251222',
      timeout: 120000,
    },
    local: {
      apiKey: '',
      provider: 'ollama',
      model: 'llama2',
      timeout: 120000,
      service: { type: 'ollama', host: '127.0.0.1', port: 11434 },
    },
  },
  'image-generate': {
    id: 'image-generate',
    name: '图片生成',
    category: 'image-generate',
    description: '文本生成图片、图片转图片、风格转换',
    enabled: true,
    source: 'cloud',
    cloud: {
      apiKey: '',
      provider: 'minimax',
      model: 'image-01',
      timeout: 90000,
    },
    local: {
      apiKey: '',
      provider: 'custom',
      timeout: 90000,
      service: { type: 'comfyui', host: '127.0.0.1', port: 8188, workflowId: 'text2img' },
    },
  },
  'image-edit': {
    id: 'image-edit',
    name: '图片编辑',
    category: 'image-edit',
    description: '移除背景、高清放大、去水印',
    enabled: true,
    source: 'cloud',
    cloud: {
      apiKey: '',
      provider: 'zhipu',
      model: 'default',
      timeout: 60000,
    },
    local: {
      apiKey: '',
      provider: 'custom',
      timeout: 60000,
      service: { type: 'comfyui', host: '127.0.0.1', port: 8188, workflowId: 'image-edit' },
    },
  },
  '3d-modeling': {
    id: '3d-modeling',
    name: '3D建模',
    category: '3d-modeling',
    description: '图转浮雕、图转3D模型、图像立体化',
    enabled: true,
    source: 'cloud',
    cloud: {
      apiKey: '',
      provider: 'meshy',
      model: 'meshy-v3',
      timeout: 120000,
    },
    local: {
      apiKey: '',
      provider: 'custom',
      timeout: 120000,
      service: { type: 'comfyui', host: '127.0.0.1', port: 8188, workflowId: '3d-modeling' },
    },
  },
  'video-generate': {
    id: 'video-generate',
    name: '视频生成',
    category: 'video-generate',
    description: '文本生成视频、图片生成视频',
    enabled: true,
    source: 'cloud',
    cloud: {
      apiKey: '',
      provider: 'zhipu',
      model: 'cogvideox',
      timeout: 180000,
    },
    local: {
      apiKey: '',
      provider: 'custom',
      timeout: 180000,
      service: { type: 'comfyui', host: '127.0.0.1', port: 8188, workflowId: 'video-gen' },
    },
  },
};

// ==================== 功能算力消耗 ====================

export const FEATURE_COSTS: Record<string, number> = {
  dialogue: 2,
  text2img: 15,
  refine: 20,
  blend: 15,
  oneclick: 15,
  multiview: 20,
  sketch: 15,
  free: 15,
  relief: 20,
  image3d: 30,
  '2dto3d': 25,
  'image-3d': 30, // 兼容别名（规范 ID 为 image3d，见 lib/api-service.ts#featureIdAliases）
  removebg: 5,
  upscale: 5,
  watermark: 5,
  text2video: 50,
  img2video: 40,
  tryon: 25, // 佩戴效果算力 (与 src/lib/feature-costs.ts 默认值保持一致)
};

// ==================== 功能 → API 映射 ====================

export const FEATURE_API_MAP: Record<string, string> = {
  'text2img': 'image-generate',
  'dialogue': 'llm-chat',
  'relief': '3d-modeling',
  'image3d': '3d-modeling',
  'image-3d': '3d-modeling', // 兼容别名（规范 ID 为 image3d）
  '2dto3d': '3d-modeling',
  'refine': 'image-generate',
  'blend': 'image-generate',
  'multiview': 'image-generate',
  'sketch': 'image-generate',
  'free': 'image-generate',
  'text2video': 'video-generate',
  'img2video': 'video-generate',
  'removebg': 'image-edit',
  'upscale': 'image-edit',
  'watermark': 'image-edit',
  'oneclick': 'image-generate',
  'tryon': 'image-generate', // 佩戴效果走图片生成通道 (云端: minimax / 本地: comfyui)
};

// ==================== 图片生成 API 提供商配置 ====================

export const PROVIDER_ENDPOINTS: Record<ImageProvider, {
  url: string;
  defaultModel: string;
  headers: (apiKey: string) => Record<string, string>;
  buildBody: (prompt: string, options: Record<string, unknown>) => Record<string, unknown>;
  parseResponse: (data: unknown) => string[];
}> = {
  openai: {
    url: 'https://api.openai.com/v1/images/generations',
    defaultModel: 'dall-e-3',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (prompt, options) => ({
      model: (options.model as string) || 'dall-e-3',
      prompt,
      n: (options.count as number) || 1,
      size: (options.size as string) || '1024x1024',
      quality: (options.quality as string) || 'standard',
    }),
    parseResponse: (data: unknown) => {
      const d = data as { data?: Array<{ url?: string; b64_json?: string }> };
      return d.data?.map((img) => img.url || img.b64_json || '') || [];
    },
  },
  zhipu: {
    url: 'https://open.bigmodel.cn/api/paas/v4/images/generations',
    defaultModel: 'cogview-3',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (prompt, options) => ({
      model: (options.model as string) || 'cogview-3',
      prompt,
      size: (options.size as string) || '1024x1024',
    }),
    parseResponse: (data: unknown) => {
      const d = data as { data?: Array<{ url?: string; b64_json?: string }> };
      return d.data?.map((img) => img.url || img.b64_json || '') || [];
    },
  },
  qwen: {
    url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
    defaultModel: 'wanx-v1',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (prompt, options) => ({
      model: (options.model as string) || 'wanx-v1',
      input: { prompt },
      parameters: { size: (options.size as string) || '1024*1024', n: (options.count as number) || 1 },
    }),
    parseResponse: (data: unknown) => {
      const d = data as { output?: { image_url?: string } };
      return d.output?.image_url ? [d.output.image_url] : [];
    },
  },
  kimi: {
    url: 'https://api.moonshot.cn/v1/images/generations',
    defaultModel: '',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (prompt, options) => ({
      model: (options.model as string) || 'kimi-image',
      prompt,
      n: (options.count as number) || 1,
      size: (options.size as string) || '1024x1024',
    }),
    parseResponse: (data: unknown) => {
      const d = data as { data?: Array<{ url?: string; b64_json?: string }> };
      return d.data?.map((img) => img.url || img.b64_json || '') || [];
    },
  },
  minimax: {
    url: 'https://api.minimax.chat/v1/image_generation',
    defaultModel: 'image-01',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (prompt, options) => ({
      model: (options.model as string) || 'image-01',
      prompt,
      num_images: (options.count as number) || 1,
      size: (options.size as string) || '1024x1024',
    }),
    parseResponse: (data: unknown) => {
      const d = data as { data?: { image_urls?: string[]; images?: Array<{ base64_url?: string; img_url?: string }> } };
      if (d.data?.image_urls?.length) return d.data.image_urls;
      if (d.data?.images) return d.data.images.map((img) => img.base64_url || img.img_url || '');
      return [];
    },
  },
  meshy: {
    url: 'https://api.meshy.ai/openapi/v1/image-to-3d',
    defaultModel: 'meshy-1',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (prompt, options) => ({ image_url: prompt, should_remesh: (options.shouldRemesh as boolean) ?? true }),
    parseResponse: (data: unknown) => {
      const d = data as { result?: string };
      return d.result ? [d.result] : [];
    },
  },
  custom: {
    url: '',
    defaultModel: '',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (prompt, options) => ({ prompt, ...options }),
    parseResponse: (data: unknown) => {
      const d = data as { data?: Array<{ url?: string }>; images?: string[]; url?: string };
      if (d.data) return d.data.map((img) => img.url || '');
      if (d.images) return d.images;
      if (d.url) return [d.url];
      return [];
    },
  },
};

// ==================== 视频生成 API 提供商配置 ====================

export const VIDEO_PROVIDER_ENDPOINTS: Record<VideoProvider, {
  url: string;
  defaultModel: string;
  headers: (apiKey: string) => Record<string, string>;
  buildBody: (options: Record<string, unknown>) => Record<string, unknown>;
  parseResponse: (data: unknown) => { videoUrl?: string; coverImage?: string };
}> = {
  zhipu: {
    url: 'https://open.bigmodel.cn/api/paas/v4/videos/generations',
    defaultModel: 'cogvideox',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (options) => ({
      model: (options.model as string) || 'cogvideox',
      prompt: options.prompt,
      image_url: options.image,
      duration: (options.duration as number) || 4,
    }),
    parseResponse: (data: unknown) => {
      const d = data as { data?: { video_url?: string; cover_image_url?: string }; output?: { video_url?: string; cover_image_url?: string } };
      return {
        videoUrl: d.data?.video_url || d.output?.video_url,
        coverImage: d.data?.cover_image_url || d.output?.cover_image_url,
      };
    },
  },
  runway: {
    url: 'https://api.runwayml.com/v1/video_generation',
    defaultModel: 'gen-2',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (options) => ({
      model: (options.model as string) || 'gen-2',
      prompt_text: options.prompt,
      image: options.image,
      duration: (options.duration as number) || 4,
    }),
    parseResponse: (data: unknown) => {
      const d = data as { output?: { video_url?: string; preview_image_url?: string } };
      return { videoUrl: d.output?.video_url, coverImage: d.output?.preview_image_url };
    },
  },
  pika: {
    url: 'https://api.pika.art/v1/video/generate',
    defaultModel: 'pika-v1',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (options) => ({
      model: (options.model as string) || 'pika-v1',
      prompt: options.prompt,
      image_url: options.image,
      duration: (options.duration as number) || 4,
    }),
    parseResponse: (data: unknown) => {
      const d = data as { output?: { video_url?: string; cover_image_url?: string } };
      return { videoUrl: d.output?.video_url, coverImage: d.output?.cover_image_url };
    },
  },
  sora: {
    url: 'https://api.openai.com/v1/video/generations',
    defaultModel: 'sora-v1',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (options) => ({
      model: (options.model as string) || 'sora-v1',
      prompt: options.prompt,
      image: options.image ? { url: options.image as string } : undefined,
      duration: (options.duration as number) || 4,
    }),
    parseResponse: (data: unknown) => {
      const d = data as { data?: Array<{ url?: string; cover_image_url?: string }> };
      return { videoUrl: d.data?.[0]?.url, coverImage: d.data?.[0]?.cover_image_url };
    },
  },
  qwen: {
    url: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video/generation',
    defaultModel: '',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (options) => ({
      model: (options.model as string) || 'video-01',
      input: { prompt: options.prompt, image_url: options.image },
      parameters: { duration: (options.duration as number) || 4 },
    }),
    parseResponse: (data: unknown) => {
      const d = data as { output?: { video_url?: string; cover_image_url?: string } };
      return { videoUrl: d.output?.video_url, coverImage: d.output?.cover_image_url };
    },
  },
  kimi: {
    url: 'https://api.moonshot.cn/v1/video/generation',
    defaultModel: '',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (options) => ({
      model: (options.model as string) || 'kimi-video',
      prompt: options.prompt,
      image_url: options.image,
      duration: (options.duration as number) || 4,
    }),
    parseResponse: (data: unknown) => {
      const d = data as { output?: { video_url?: string; cover_image_url?: string } };
      return { videoUrl: d.output?.video_url, coverImage: d.output?.cover_image_url };
    },
  },
  minimax: {
    url: 'https://api.minimax.chat/v1/video_generation',
    defaultModel: 'video-01',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (options) => ({
      model: (options.model as string) || 'video-01',
      prompt: options.prompt,
      image_url: options.image,
      duration: (options.duration as number) || 4,
    }),
    parseResponse: (data: unknown) => {
      const d = data as { data?: { video_url?: string; cover_image_url?: string } };
      return { videoUrl: d.data?.video_url, coverImage: d.data?.cover_image_url };
    },
  },
  custom: {
    url: '',
    defaultModel: '',
    headers: (apiKey) => ({ Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
    buildBody: (options) => options,
    parseResponse: (data: unknown) => {
      const d = data as { videoUrl?: string; video_url?: string; url?: string; coverImage?: string; cover_image_url?: string };
      return { videoUrl: d.videoUrl || d.video_url || d.url, coverImage: d.coverImage || d.cover_image_url };
    },
  },
};

// ==================== 辅助函数 ====================

export function getFeatureCost(featureId: string): number {
  return FEATURE_COSTS[featureId] ?? 10;
}

export function getFeatureConfig(featureId: string): FeatureConfig | undefined {
  return featureConfigs.find((f) => f.id === featureId);
}

export function getFeatureApiId(featureId: string): string | undefined {
  return FEATURE_API_MAP[featureId];
}

// ==================== 完整功能配置列表 ====================

export const featureConfigs: FeatureConfig[] = [
  // 浮雕圆雕（3个）
  { id: 'relief', name: '图转浮雕图', group: '浮雕圆雕', apiId: '3d-modeling', cost: 20, description: '将图片转换为浮雕风格' },
  { id: 'image3d', name: '图转3D模型', group: '浮雕圆雕', apiId: '3d-modeling', cost: 30, description: '图片转3D模型预览', supportsAIAssistant: true },
  { id: '2dto3d', name: '平面转雕塑', group: '浮雕圆雕', apiId: '3d-modeling', cost: 25, description: '2D平面转雕塑效果' },
  // 灵感与创作（8个）
  { id: 'dialogue', name: 'AI对话', group: '灵感与创作', apiId: 'llm-chat', cost: 2, description: '流式AI对话功能', supportsAIAssistant: true },
  { id: 'text2img', name: '文案生图', group: '灵感与创作', apiId: 'image-generate', cost: 15, description: '文字描述生成图片', supportsAIAssistant: true },
  { id: 'refine', name: '产品精修', group: '灵感与创作', apiId: 'image-generate', cost: 20, description: '产品图片优化', supportsAIAssistant: true },
  { id: 'blend', name: '多图融合', group: '灵感与创作', apiId: 'image-generate', cost: 15, description: '多张图片融合', supportsAIAssistant: true },
  { id: 'oneclick', name: '一键设计', group: '灵感与创作', apiId: 'image-generate', cost: 15, description: '快速生成设计', supportsAIAssistant: true },
  { id: 'multiview', name: '生成多视图', group: '灵感与创作', apiId: 'image-generate', cost: 20, description: '生成多角度视图', supportsAIAssistant: true },
  { id: 'sketch', name: '线稿/写实', group: '灵感与创作', apiId: 'image-generate', cost: 15, description: '风格转换', supportsAIAssistant: true },
  { id: 'free', name: '自由创作区', group: '灵感与创作', apiId: 'image-generate', cost: 15, description: '自由创作', supportsAIAssistant: true },
  // 生成视频（2个）
  { id: 'text2video', name: '文生视频', group: '生成视频', apiId: 'video-generate', cost: 50, description: '文字生成视频', supportsAIAssistant: true },
  { id: 'img2video', name: '图生视频', group: '生成视频', apiId: 'video-generate', cost: 40, description: '图片生成视频', supportsAIAssistant: true },
  // 实用工具（4个）
  { id: 'removebg', name: '移除背景', group: '实用工具', apiId: 'image-edit', cost: 5, description: '一键抠图' },
  { id: 'upscale', name: '高清放大', group: '实用工具', apiId: 'image-edit', cost: 5, description: '图片放大增强' },
  { id: 'watermark', name: '去除水印', group: '实用工具', apiId: 'image-edit', cost: 5, description: '智能去水印' },
  // 佩戴效果 (2026-08-03 补齐闭环)
  { id: 'tryon', name: '佩戴效果', group: '实用工具', apiId: 'image-generate', cost: 25, description: 'AI 虚拟试戴效果生成', supportsAIAssistant: true },
];

// ==================== 全局算力来源 ====================

let _globalPowerSource: PowerSource = 'cloud';

export function getGlobalPowerSource(): PowerSource {
  return _globalPowerSource;
}

export function setGlobalPowerSource(source: PowerSource): void {
  _globalPowerSource = source;
  Object.values(coreApiConfigs).forEach((config) => {
    config.source = source;
  });
}

export function toggleApiSource(apiId: string, source?: PowerSource): PowerSource {
  const config = coreApiConfigs[apiId];
  if (!config) return 'cloud';
  const newSource = source || (config.source === 'cloud' ? 'local' : 'cloud');
  config.source = newSource;
  return newSource;
}

// ==================== 功能启用状态 ====================

// API Key 环境变量映射（按优先级查找）
const _envKeyMap: Record<string, string> = {
  'llm-chat': process.env.ZHIPU_API_KEY || process.env.QWEN_API_KEY || process.env.LLM_API_KEY || '',
  'image-generate': process.env.MINIMAX_API_KEY || process.env.IMAGE_API_KEY || process.env.ZHIPU_API_KEY || '',
  '3d-modeling': process.env.MESHY_API_KEY || process.env.IMAGE_API_KEY || process.env.ZHIPU_API_KEY || '',
  'video-generate': process.env.ZHIPU_API_KEY || process.env.VIDEO_API_KEY || '',
  'image-edit': process.env.MINIMAX_API_KEY || process.env.IMAGE_API_KEY || process.env.ZHIPU_API_KEY || '',
};

export function isFeatureEnabled(featureId: string): {
  enabled: boolean;
  apiId: string;
  reason?: string;
} {
  const feature = getFeatureConfig(featureId);
  if (!feature) return { enabled: false, apiId: '', reason: '功能不存在' };
  const apiConfig = coreApiConfigs[feature.apiId];
  if (!apiConfig) return { enabled: false, apiId: feature.apiId, reason: '对应的API配置不存在' };
  if (!apiConfig.enabled) return { enabled: false, apiId: feature.apiId, reason: '对应的API已被禁用' };

  const source = apiConfig.source || 'cloud';
  const endpoint = source === 'cloud' ? apiConfig.cloud : apiConfig.local;
  let apiKey = endpoint.apiKey || '';

  if (!apiKey?.trim()) {
    apiKey = _envKeyMap[feature.apiId] || '';
  }

  if (!apiKey?.trim()) {
    if (process.env.NODE_ENV !== 'production') {
      return { enabled: true, apiId: feature.apiId, reason: '开发模式：API Key 未配置，功能可用但实际调用会失败' };
    }
    return { enabled: false, apiId: feature.apiId, reason: '未配置 API Key' };
  }

  return { enabled: true, apiId: feature.apiId };
}



// ==================== API 映射类型（向后兼容） ====================

export interface ApiMapping {
  configs: Record<string, CoreApiConfig>;
  features: FeatureConfig[];
  globalSource: PowerSource;
}

// 功能→API 映射（向后兼容 admin 路由）
export const featureApiMapping: Record<string, string> = Object.fromEntries(
  featureConfigs.map((f) => [f.id, f.apiId])
);
