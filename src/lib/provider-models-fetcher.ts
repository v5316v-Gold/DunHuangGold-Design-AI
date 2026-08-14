/**
 * Provider Models Fetcher
 *
 * 从各 LLM provider 公开 API 拉取模型清单 + 自动分类
 * 当前支持：minimax / deepseek
 *
 * 输出：[{ id, label, category, ownedBy? }]
 */


/* eslint-disable @typescript-eslint/no-explicit-any */
export type ModelCategory = 'chat' | 'image' | 'video' | '3d' | 'embedding' | 'audio' | 'multimodal' | 'other';

export interface FetchedModel {
  id: string;
  label: string;
  category: ModelCategory;
  ownedBy?: string;
}

/** Provider 配置 */
interface ProviderConfig {
  id: 'minimax' | 'deepseek' | 'anthropic' | 'qwen' | 'openai' | 'zhipu';
  /** 模型清单 API 端点（OpenAI 兼容格式） */
  modelsEndpoint: (baseUrl: string) => string;
  /** 鉴权方式 */
  authHeader: (apiKey: string) => Record<string, string>;
  /** 响应解析（不同 provider 字段名可能不同） */
  parseResponse: (json: any) => Array<{ id: string; ownedBy?: string }>;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  minimax: {
    id: 'minimax',
    modelsEndpoint: (base) => `${base.replace(/\/$/, '')}/models`,
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    // OpenAI 兼容格式：{ data: [{ id, owned_by }] }
    parseResponse: (json) => {
      const list = Array.isArray(json?.data) ? json.data : [];
      return list.map((m: any) => ({ id: m.id, ownedBy: m.owned_by || 'minimax' }));
    },
  },
  deepseek: {
    id: 'deepseek',
    modelsEndpoint: (base) => `${base.replace(/\/$/, '')}/models`,
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    parseResponse: (json) => {
      const list = Array.isArray(json?.data) ? json.data : [];
      return list.map((m: any) => ({ id: m.id, ownedBy: m.owned_by || 'deepseek' }));
    },
  },
  // 预留扩展位（v2 实施）
  anthropic: {
    id: 'anthropic',
    modelsEndpoint: (base) => `${base.replace(/\/$/, '')}/v1/models`,
    authHeader: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
    parseResponse: (json) => {
      const list = Array.isArray(json?.data) ? json.data : [];
      return list.map((m: any) => ({ id: m.id, ownedBy: 'anthropic' }));
    },
  },
  qwen: {
    id: 'qwen',
    modelsEndpoint: (base) => `${base.replace(/\/$/, '')}/models`,
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    parseResponse: (json) => {
      const list = Array.isArray(json?.data) ? json.data : json?.output || [];
      return list.map((m: any) => ({ id: m.id || m.model, ownedBy: 'qwen' }));
    },
  },
};

/**
 * 根据模型 ID 启发式分类
 */
export function classifyModel(modelId: string, ownedBy?: string): ModelCategory {
  const id = modelId.toLowerCase();

  // 3D
  if (/meshy|tripo|kaedim|hunyuan-3d|hunyuan3d|rodin|csm|trellis/.test(id)) return '3d';

  // 视频
  if (/sora|kling|runway|veo|hunyuan-video|hunyuanvideo|cogvideox|ltx-|wan2|hailuo|pika|svd/.test(id)) return 'video';

  // 图像
  if (/dall-?e|cogview|wanx|imagen|sdxl|flux|seedream|kandinsky|midjourney|stablediffusion|sd-/.test(id)) return 'image';

  // 嵌入
  if (/embed|embedding|text-embed|bge-/.test(id)) return 'embedding';

  // 语音
  if (/whisper|tts-|tts\d|audio|speech|suno|musicgen/.test(id)) return 'embedding'; // 暂时归 embedding

  // 多模态（VLM）
  if (/^(qwen-)?vl|gpt-4o|gpt-4v|claude-3.*-opus|claude-3.*-sonnet|gemini.*vision|minimax-vision/.test(id)) {
    return 'multimodal';
  }

  // 推理模型（DeepSeek-R1 等）
  if (/reasoner|reasoning|deepseek-r|o1-|o3-/.test(id)) return 'chat';

  // 默认 chat
  return 'chat';
}

/** 分类中文标签 */
export const CATEGORY_LABELS: Record<ModelCategory, string> = {
  chat: '对话',
  image: '图像',
  video: '视频',
  '3d': '3D',
  embedding: '嵌入',
  audio: '语音',
  multimodal: '多模态',
  other: '其他',
};

/** 分类图标（emoji） */
export const CATEGORY_ICONS: Record<ModelCategory, string> = {
  chat: '💬',
  image: '🖼',
  video: '🎬',
  '3d': '🧊',
  embedding: '📊',
  audio: '🔊',
  multimodal: '👁',
  other: '📦',
};

/**
 * 从 provider 拉取模型清单
 */
export async function fetchProviderModels(opts: {
  provider: 'minimax' | 'deepseek' | 'anthropic' | 'qwen' | 'openai' | 'zhipu';
  apiKey: string;
  endpoint: string;
  signal?: AbortSignal;
}): Promise<{ models: FetchedModel[]; raw?: any; error?: string }> {
  const config = PROVIDER_CONFIGS[opts.provider];
  if (!config) {
    return { models: [], error: `暂不支持的 provider: ${opts.provider}` };
  }
  if (!opts.apiKey) {
    return { models: [], error: '缺少 API Key' };
  }
  if (!opts.endpoint) {
    return { models: [], error: '缺少 endpoint' };
  }

  const url = config.modelsEndpoint(opts.endpoint);
  const headers = {
    'Content-Type': 'application/json',
    ...config.authHeader(opts.apiKey),
  };

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: opts.signal,
      // 5 秒超时
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        models: [],
        error: `HTTP ${res.status}: ${body.slice(0, 200) || res.statusText}`,
      };
    }

    const json = await res.json();
    const raw = config.parseResponse(json);

    const models: FetchedModel[] = raw.map((m) => {
      const category = classifyModel(m.id, m.ownedBy);
      return {
        id: m.id,
        label: m.id, // provider 通常不返回 label
        category,
        ownedBy: m.ownedBy,
      };
    });

    return { models, raw: json };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { models: [], error: '请求超时' };
    }
    return { models: [], error: err?.message || '未知错误' };
  }
}
