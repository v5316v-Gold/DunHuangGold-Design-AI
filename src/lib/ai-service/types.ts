/**
 * AI 服务层 — 核心类型定义
 */

// ============================================================
// 服务类型枚举
// ============================================================
export type AIServiceType =
  | 'text2img'    // 文生图
  | 'refine'      // 产品精修
  | 'relief'      // 浮雕设计
  | 'image3d'     // 图转3D
  | 'stereo'      // 平面转雕塑
  | 'removebg'     // 移除背景
  | 'upscale'      // 高清放大
  | 'watermark'   // 去除水印
  | 'sketch'       // 线稿写实
  | 'blend'       // 多图融合
  | 'oneclick'    // 一键设计
  | 'multiview'   // 多视图生成
  | 'free'        // 自由创作
  | 'text2video'  // 文生视频
  | 'img2video'   // 图生视频
  | 'dialogue'    // AI 对话
  | 'tryon'       // 佩戴效果（2026-08-03 补齐，与 17 功能清单对齐）
  | 'ai-assistant'; // AI 助手

// ============================================================
// 生成请求
// ============================================================
export interface GenerationRequest {
  service: AIServiceType;
  prompt?: string;
  image?: string;         // 单张输入图（URL）
  images?: string[];      // 多张输入图（URL 数组）
  negativePrompt?: string;
  width?: number;
  height?: number;
  count?: number;         // 生成数量
  resolution?: '1k' | '2k' | '4k';
  ratio?: string;        // '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '9:16' | '16:9'
  strength?: number;     // 修改强度（0-1）
  depthLevel?: string;   // 浮雕深度级别
  modelType?: string;    // 模型类型
  // 扩展参数
  [key: string]: unknown;
}

// ============================================================
// 生成结果
// ============================================================
export interface GenerationResult {
  success: boolean;
  data?: string | string[];  // 图片 URL(s)
  provider: Provider;
  workflow?: string;
  powerCost?: number;
  error?: string;
  prompt_id?: string;    // 异步任务 ID
  sse_url?: string;      // SSE 轮询 URL
  localSaved?: boolean;
}

export type Provider = 'comfyui' | 'minimax' | 'meshy' | 'kling' | 'fallback';

// ============================================================
// 服务配置
// ============================================================
export interface ServiceConfig {
  /** 服务类型 ID */
  type: AIServiceType;
  /** 用户可见名称 */
  label: string;
  /** 功能成本（算力点） */
  powerCost: number;
  /** 是否需要输入图片 */
  requiresImage: boolean;
  /** 主要提供者 */
  primaryProvider: Provider;
  /** ComfyUI 工作流 ID（如有） */
  comfyuiWorkflowId?: string;
  /** 云端 API 配置 */
  cloudProvider?: Provider;
  /** 执行函数 */
  execute: (req: GenerationRequest) => Promise<GenerationResult>;
}

// ============================================================
// 统一入口请求（API 接收的 JSON）
// ============================================================
export interface UnifiedGenerateRequest {
  service: AIServiceType;
  // GenerationRequest 的其他字段
  [key: string]: unknown;
}

// ============================================================
// 统一入口响应（API 返回的 JSON）
// ============================================================
export interface UnifiedGenerateResponse {
  success: boolean;
  data?: string | string[];
  provider?: Provider;
  powerCost?: number;
  prompt_id?: string;
  sse_url?: string;
  error?: string;
  code?: string;
}
