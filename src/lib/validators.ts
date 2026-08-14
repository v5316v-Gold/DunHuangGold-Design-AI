/**
 * 统一参数验证层
 * 使用 zod 对所有 API 路由进行 schema 验证
 * 验证失败直接返回 400，不再进入业务逻辑
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';

/* eslint-disable @typescript-eslint/no-explicit-any */


// ============================================================
// 公共 Schema
// ============================================================

/** 聊天消息格式（支持多模态） */
export const chatMessageSchema = z.union([
  // 纯文本消息
  z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  }),
  // 多模态消息（Minimax 格式）
  z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.array(
      z.discriminatedUnion('type', [
        z.object({ type: z.literal('text'), text: z.string() }),
        z.object({ type: z.literal('image_url'), image_url: z.object({ url: z.string() }) }),
      ])
    ),
  }),
]);

/** 分页参数 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** ID 参数 */
export const idParamSchema = z.object({
  id: z.string().min(1, 'ID 不能为空'),
});

// ============================================================
// 核心业务 Schema
// ============================================================

/** AI 对话 */
export const chatSchema = z.object({
  messages: z.array(chatMessageSchema).min(1, '消息列表不能为空'),
  provider: z.enum(['minimax', 'openclaw', 'anthropic', 'qwen', 'deepseek', 'custom', 'hermes']).optional(),
  conversationId: z.string().optional(),
  // 模型选择（来自 ModelPickerModal）
  model: z.string().optional(),
  // LLM 调优参数
  temperature: z.coerce.number().min(0).max(2).optional(),
  max_tokens: z.coerce.number().int().min(50).max(32000).optional(),
  top_p: z.coerce.number().min(0).max(1).optional(),
  thinking_depth: z.enum(['low', 'medium', 'high']).optional(),
  system_prompt: z.string().max(2000).optional(),
});

/** AI 写作助手 */
export const aiAssistantSchema = z.object({
  message: z.string().min(1, '消息内容不能为空').max(10000, '消息内容过长'),
  context: z.string().max(50000, '上下文过长').optional(),
});

/** 图片生成 */
export const generateImageSchema = z.object({
  prompt: z.string().min(1, '提示词不能为空').max(5000, '提示词过长'),
  count: z.coerce.number().int().min(1).max(4).default(1),
  resolution: z.enum(['1k', '2k', '4k']).default('2k'),
  ratio: z.enum(['auto', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']).default('auto'),
  useComfyui: z.boolean().default(true),
  async: z.boolean().optional().default(false),
});

/** 产品精修 */
export const productRefineSchema = z.object({
  imageUrl: z.string().url('请提供有效的图片 URL'),
  prompt: z.string().max(2000).optional(),
  strength: z.coerce.number().min(0).max(1).default(0.5),
});

/** 多图融合 */
export const multiImageSchema = z.object({
  images: z.array(z.string().url()).min(2, '至少需要2张图片').max(10, '最多10张图片'),
  mode: z.enum(['normal', 'blend', 'multiply', 'screen']).default('normal'),
  weights: z.array(z.number().min(0).max(1)).optional(),
});

/** 一键设计 */
export const oneClickDesignSchema = z.object({
  type: z.enum(['poster', 'logo', 'banner', 'card']).default('poster'),
  theme: z.string().min(1).max(500),
  style: z.string().max(200).optional(),
});

/** 多视图生成 */
export const multiViewSchema = z.object({
  imageUrl: z.string().url('请提供有效的图片 URL'),
  views: z.coerce.number().int().min(4).max(36).default(8),
});

/** 线稿转写实 */
export const sketchRealisticSchema = z.object({
  imageUrl: z.string().url('请提供有效的图片 URL'),
  prompt: z.string().max(1000).optional(),
  strength: z.coerce.number().min(0).max(1).default(0.7),
});

/** 自由创作 */
export const freeCreationSchema = z.object({
  prompt: z.string().min(1).max(5000),
  style: z.string().max(200).optional(),
  count: z.coerce.number().int().min(1).max(4).default(1),
});

/** 浮雕设计 */
export const reliefSchema = z.object({
  imageUrl: z.string().url('请提供有效的图片 URL'),
  depth: z.coerce.number().min(1).max(10).default(5),
  style: z.enum(['emboss', 'deboss', 'carve']).default('emboss'),
});

/** 图转 3D */
export const image3DSchema = z.object({
  imageUrl: z.string().url('请提供有效的图片 URL'),
  format: z.enum(['glb', 'fbx', 'obj']).default('glb'),
  resolution: z.enum(['512', '1024', '2048']).default('1024'),
});

/** 平面转雕塑 */
export const stereoSchema = z.object({
  imageUrl: z.string().url('请提供有效的图片 URL'),
  depth: z.coerce.number().min(1).max(20).default(10),
});

/** 移除背景 */
export const removeBackgroundSchema = z.object({
  imageUrl: z.string().url('请提供有效的图片 URL'),
  method: z.enum(['u2net', 'rembg']).default('u2net'),
});

/** 高清放大 */
export const upscaleSchema = z.object({
  imageUrl: z.string().url('请提供有效的图片 URL'),
  scale: z.coerce.number().int().min(2).max(4).default(2),
  model: z.enum(['realesrgan', 'gopeq']).default('realesrgan'),
});

/** 去除水印 */
export const removeWatermarkSchema = z.object({
  imageUrl: z.string().url('请提供有效的图片 URL'),
});

/** 文生视频 */
export const text2VideoSchema = z.object({
  prompt: z.string().min(1).max(2000),
  duration: z.coerce.number().int().min(1).max(10).default(4),
  fps: z.coerce.number().int().min(24).max(60).default(30),
});

/** 图生视频 */
export const image2VideoSchema = z.object({
  imageUrl: z.string().url('请提供有效的图片 URL'),
  prompt: z.string().max(1000).optional(),
  duration: z.coerce.number().int().min(1).max(10).default(4),
});

/** Prompt 优化 */
export const promptOptimizeSchema = z.object({
  prompt: z.string().min(1).max(5000),
  ruleId: z.enum(['expand-general', 'expand-dunhuang', 'condense', 'translate-zh', 'translate-en']).default('expand-general'),
});

/** 翻译 */
export const translateSchema = z.object({
  text: z.string().min(1).max(10000),
  dir: z.enum(['zh-en', 'en-zh']).default('zh-en'),
});

// ============================================================
// 通用验证装饰器
// ============================================================

type ZodSchema = z.ZodType<any, any, any>;

/**
 * 创建验证中间件
 * 验证失败返回 400，成功则返回解析后的数据
 */
export function withValidation<T extends ZodSchema>(
  schema: T,
  source: 'body' | 'query' = 'body'
) {
  return function (handler: (data: z.infer<T>, request: Request) => Promise<Response>) {
    return async (request: Request): Promise<Response> => {
      try {
        let data: unknown;

        if (source === 'body') {
          data = await request.clone().json();
        } else {
          const url = new URL(request.url);
          data = Object.fromEntries(url.searchParams);
        }

        const parsed = schema.parse(data);

        return await handler(parsed, request);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = error.issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          }));

          return NextResponse.json(
            {
              success: false,
              error: '参数验证失败',
              details: errors,
            },
            { status: 400 }
          );
        }

        // 非 zod 错误，透传到 error-handler
        throw error;
      }
    };
  };
}

/**
 * 快速验证函数（用于内联使用）
 * @returns 验证结果，成功返回解析后数据，失败返回 null
 */
export function safeParse<T extends ZodSchema>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  try {
    return { success: true, data: schema.parse(data) };
  } catch (error) {
    return { success: false, error: error as z.ZodError };
  }
}

// ============================================================
// 错误脱敏
// ============================================================

/**
 * 用户友好的错误消息映射
 * 生产环境中不暴露内部实现细节
 */
const ERROR_MESSAGES: Record<string, string> = {
  // 通用错误
  'ECONNREFUSED': '服务暂时不可用，请稍后重试',
  'ENOTFOUND': '服务地址错误，请联系管理员',
  'ETIMEDOUT': '请求超时，请检查网络连接',
  'NETWORK_ERROR': '网络错误，请检查网络连接',
  'TIMEOUT': '请求超时，请稍后重试',

  // 外部 API 错误（不暴露具体 provider 信息）
  'MINIMAX_API_ERROR': '图片生成服务暂时不可用，请稍后重试',
  'ZHIPU_API_ERROR': 'AI 服务暂时不可用，请稍后重试',
  'OPENAI_API_ERROR': 'AI 服务暂时不可用，请稍后重试',
  'QWEN_API_ERROR': 'AI 服务暂时不可用，请稍后重试',
  'DOUBAN_API_ERROR': 'AI 服务暂时不可用，请稍后重试',
  'KIMI_API_ERROR': 'AI 服务暂时不可用，请稍后重试',

  // OpenClaw 错误
  'OPENCLAW_NOT_FOUND': 'AI 服务未启动，请检查配置',
  'OPENCLAW_TIMEOUT': 'AI 服务响应超时，请稍后重试',
  'OPENCLAW_ERROR': 'AI 服务调用失败，请稍后重试',

  // 数据库错误
  'DB_CONNECTION_ERROR': '数据库连接失败，请联系管理员',
  'DB_QUERY_ERROR': '数据操作失败，请稍后重试',

  // 验证错误
  'VALIDATION_ERROR': '参数格式错误',
  'INVALID_API_KEY': 'API 配置错误，请联系管理员',
};

/**
 * 判断是否为内部错误关键词（用于日志记录，不返回给用户）
 */
function isInternalErrorKeyword(message: string): boolean {
  const internalPatterns = [
    /api\.minimax/i,
    /api\.bigmodel/i,
    /dashscope/i,
    /volces\.com/i,
    /moonshot/i,
    /openai\.com/i,
    /localhost:/i,
    /127\.0\.0\.1/i,
    /\.env/i,
    /password/i,
    /secret/i,
    /token/i,
    /apikey/i,
    /sk-/i,
  ];
  return internalPatterns.some(pattern => pattern.test(message));
}

/**
 * 脱敏错误消息
 * @param error 原始错误
 * @param fallbackMessage 通用回退消息
 * @param isDevelopment 是否开发环境
 */
export function sanitizeError(
  error: unknown,
  fallbackMessage: string = '操作失败，请稍后重试',
  isDevelopment: boolean = process.env.NODE_ENV === 'development'
): { message: string; logged: boolean } {
  // 记录原始错误（包含敏感信息），但不返回给用户
  const errorMessage = error instanceof Error ? error.message : String(error);

  // 开发环境可以看完整错误
  if (isDevelopment) {
    return { message: errorMessage, logged: true };
  }

  // 检查是否为已知错误
  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return { message, logged: true };
    }
  }

  // 检查是否包含内部信息
  if (isInternalErrorKeyword(errorMessage)) {
    return { message: fallbackMessage, logged: true };
  }

  // 截断过长错误消息
  if (errorMessage.length > 200) {
    return { message: fallbackMessage, logged: true };
  }

  // 通用错误不记录
  return { message: errorMessage, logged: false };
}

/**
 * 创建统一格式的错误响应（已脱敏）
 */
export function errorResponse(
  error: unknown,
  fallbackMessage: string = '操作失败，请稍后重试',
  statusCode: number = 500
): NextResponse {
  const { message } = sanitizeError(error, fallbackMessage);
  return NextResponse.json(
    { success: false, error: message },
    { status: statusCode }
  );
}

// ============================================================
// 导出所有 Schema 方便按需使用
// ============================================================

export const schemas = {
  chat: chatSchema,
  aiAssistant: aiAssistantSchema,
  generateImage: generateImageSchema,
  productRefine: productRefineSchema,
  multiImage: multiImageSchema,
  oneClickDesign: oneClickDesignSchema,
  multiView: multiViewSchema,
  sketchRealistic: sketchRealisticSchema,
  freeCreation: freeCreationSchema,
  relief: reliefSchema,
  image3D: image3DSchema,
  stereo: stereoSchema,
  removeBackground: removeBackgroundSchema,
  upscale: upscaleSchema,
  removeWatermark: removeWatermarkSchema,
  text2Video: text2VideoSchema,
  image2Video: image2VideoSchema,
  promptOptimize: promptOptimizeSchema,
  translate: translateSchema,
} as const;
