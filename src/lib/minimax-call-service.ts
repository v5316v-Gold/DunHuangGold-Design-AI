/**
 * Phase 9.20 · Minimax API 通用调用框架
 *
 * 4 大能力：LLM / Image / Video (async) / TTS / Music / Voice Clone
 * 协议：OpenAI 兼容 + 自有扩展
 * 基础：https://api.minimaxi.com/v1  （MiniMax 官方域名，可被环境变量 MINIMAX_API_BASE 覆盖）
 *
 * 实测可用端点（Phase 9.19）：
 *   POST /v1/chat/completions        — LLM (OpenAI 兼容)
 *   POST /v1/image_generation       — 图片
 *   POST /v1/video_generation       — 视频（异步，task_id）
 *   GET  /v1/query/video_generation  — 视频状态查询
 *   POST /v1/text_to_speech         — TTS
 *   POST /v1/voice_clone            — 声音克隆
 *   POST /v1/music_generation       — 音乐
 *   POST /v1/files/upload           — 文件上传
 *
 * 不可用（返回 NOT_SUPPORTED）：
 *   3D / image3d / relief / multiview / oneclick / free / tryon /
 *   refine / blend / removebg / upscale / watermark / sketch / stereo
 */

import { createLogger } from './error-handler';
import { logAudit } from './audit-logger';

const logger = createLogger('minimax-call');

// MiniMax 真实 API 域名（修复 2026-08-20：原 api.minimax.chat 是项目代号占位域名，
// 真实域名经 DNS 解析为 api.minimaxi.com）
const MINIMAX_API_BASE = process.env.MINIMAX_API_BASE || 'https://api.minimaxi.com/v1';

// ==================== 类型 ====================

export interface MinimaxCallOptions {
  endpoint: string;
  body: Record<string, unknown>;
  timeoutMs?: number;
  userId?: string;
  featureId?: string;
}

export interface MinimaxCallResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  httpStatus?: number;
  requestId?: string;
  taskId?: string;
}

// ==================== 通用调用 ====================

/**
 * 通用 HTTP 调用（自动鉴权 + 错误处理 + 审计）
 *
 * @param options.endpoint 例如 'chat/completions' / 'image_generation'
 * @returns 成功返回 data + requestId；异步任务额外返回 taskId
 */
export async function callMinimax<T = unknown>(
  options: MinimaxCallOptions
): Promise<MinimaxCallResult<T>> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'MINIMAX_API_KEY 未配置' };
  }

  const url = `${MINIMAX_API_BASE}/${options.endpoint}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 30000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options.body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const rawData = await response.json().catch(() => ({} as Record<string, unknown>));
    const data = rawData as {
      base_resp?: { status_code: number; status_msg: string };
      request_id?: string;
      id?: string;
      task_id?: string;
    };

    if (!response.ok) {
      const errMsg =
        data.base_resp?.status_msg || `HTTP ${response.status}`;
      logger.error(`[minimax] ${options.endpoint} 失败: ${errMsg} (status=${response.status})`);
      void logAudit({
        action: 'minimax.error',
        resourceType: 'ai',
        actorId: options.userId,
        details: {
          endpoint: options.endpoint,
          status: response.status,
          error: errMsg,
          featureId: options.featureId,
        },
      });
      return {
        success: false,
        error: errMsg,
        httpStatus: response.status,
        requestId: data.request_id || data.id,
      };
    }

    // 检查 Minimax 业务错误（base_resp.status_code !== 0）
    if (data.base_resp && data.base_resp.status_code !== 0) {
      const errMsg = data.base_resp.status_msg || 'unknown minimax error';
      logger.error(`[minimax] 业务错误: ${errMsg} (code=${data.base_resp.status_code})`);
      return {
        success: false,
        error: errMsg,
        httpStatus: response.status,
        requestId: data.request_id || data.id,
      };
    }

    return {
      success: true,
      data: rawData as T,
      requestId: data.id || data.request_id,
      taskId: data.task_id,
    };
  } catch (error) {
    clearTimeout(timeout);
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Minimax 调用失败: ${msg}` };
  }
}

// ==================== LLM 对话 ====================

/**
 * LLM 对话（OpenAI 兼容 chat/completions）
 */
export async function minimaxChat(options: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  userId?: string;
  featureId?: string;
}): Promise<
  MinimaxCallResult<{
    content: string;
    usage?: { total_tokens?: number };
  }>
> {
  const result = await callMinimax<{
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  }>({
    endpoint: 'chat/completions',
    body: {
      model: options.model || process.env.MINIMAX_MODEL || 'MiniMax-M2.5-highspeed',
      messages: options.messages,
      max_tokens: options.maxTokens || 2000,
      temperature: options.temperature ?? 0.7,
    },
    userId: options.userId,
    featureId: options.featureId,
  });

  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: {
      content: result.data.choices?.[0]?.message?.content || '',
      usage: result.data.usage,
    },
    requestId: result.requestId,
  };
}

// ==================== 图片生成 ====================

/**
 * 图片生成（image_generation）
 */
export async function minimaxImageGen(options: {
  prompt: string;
  model?: string;
  n?: number;
  userId?: string;
  featureId?: string;
}): Promise<MinimaxCallResult<{ image_urls: string[] }>> {
  const result = await callMinimax<{
    data?: { image_urls?: string[] };
    metadata?: { success_count?: string };
  }>({
    endpoint: 'image_generation',
    body: {
      model: options.model || 'image-01',
      prompt: options.prompt,
      n: options.n || 1,
    },
    userId: options.userId,
    featureId: options.featureId,
    timeoutMs: 60000,
  });

  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: { image_urls: result.data.data?.image_urls || [] },
    requestId: result.requestId,
  };
}

// ==================== 视频生成（异步） ====================

/**
 * 视频生成（video_generation 异步任务）
 */
export async function minimaxVideoGen(options: {
  prompt: string;
  imageUrl?: string;
  model?: string;
  duration?: number;
  userId?: string;
  featureId?: string;
}): Promise<MinimaxCallResult<{ taskId: string }>> {
  const result = await callMinimax<{ task_id?: string }>({
    endpoint: 'video_generation',
    body: {
      model: options.model || 'video-01',
      prompt: options.prompt,
      image_url: options.imageUrl,
      duration: options.duration || 4,
    },
    userId: options.userId,
    featureId: options.featureId,
    timeoutMs: 30000,
  });

  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const taskId = result.data.task_id;
  if (!taskId) {
    return { success: false, error: 'Minimax 未返回 task_id' };
  }

  return {
    success: true,
    data: { taskId },
    requestId: result.requestId,
    taskId,
  };
}

/**
 * 视频任务状态查询
 * GET /v1/query/video_generation?task_id=xxx
 */
export async function minimaxVideoQuery(taskId: string): Promise<{
  status: 'Preparing' | 'Processing' | 'Success' | 'Failed' | string;
  file_id: string;
  video_width: number;
  video_height: number;
}> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY 未配置');
  }
  const response = await fetch(
    `${MINIMAX_API_BASE}/query/video_generation?task_id=${taskId}`,
    { headers: { 'Authorization': `Bearer ${apiKey}` } }
  );
  return (await response.json()) as {
    status: string;
    file_id: string;
    video_width: number;
    video_height: number;
  };
}

// ==================== 语音合成 TTS ====================

/**
 * 语音合成（text_to_speech）
 * 返回音频二进制
 */
export async function minimaxTTS(options: {
  text: string;
  voiceId?: string;
  model?: string;
  userId?: string;
  featureId?: string;
}): Promise<MinimaxCallResult<{ audio: Buffer }>> {
  const result = await callMinimax<{ audio_content?: string; audio?: string }>({
    endpoint: 'text_to_speech',
    body: {
      model: options.model || 'speech-01',
      text: options.text,
      voice_setting: { voice_id: options.voiceId || 'female-shaonv' },
    },
    userId: options.userId,
    featureId: options.featureId,
    timeoutMs: 30000,
  });

  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const base64 =
    (result.data as { audio_content?: string }).audio_content ||
    (result.data as { audio?: string }).audio;
  if (!base64) {
    return { success: false, error: 'Minimax TTS 未返回音频数据' };
  }

  return {
    success: true,
    data: { audio: Buffer.from(base64, 'base64') },
    requestId: result.requestId,
  };
}

// ==================== 音乐生成（异步） ====================

/**
 * 音乐生成（music_generation 异步任务）
 */
export async function minimaxMusicGen(options: {
  prompt: string;
  lyrics?: string;
  model?: string;
  userId?: string;
  featureId?: string;
}): Promise<MinimaxCallResult<{ taskId: string }>> {
  const result = await callMinimax<{ task_id?: string }>({
    endpoint: 'music_generation',
    body: {
      model: options.model || 'music-01',
      prompt: options.prompt,
      lyrics: options.lyrics,
    },
    userId: options.userId,
    featureId: options.featureId,
    timeoutMs: 30000,
  });

  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const taskId = result.data.task_id;
  if (!taskId) {
    return { success: false, error: 'Minimax 未返回 task_id' };
  }

  return {
    success: true,
    data: { taskId },
    requestId: result.requestId,
    taskId,
  };
}

// ==================== 健康检查 ====================

/**
 * 检查 Minimax API 可用性
 */
export async function checkMinimaxHealth(): Promise<boolean> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return false;
  try {
    const response = await fetch(`${MINIMAX_API_BASE}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
