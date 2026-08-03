/**
 * ComfyUI API 路由
 * 提供统一的 ComfyUI 工作流调用接口
 * 
 * 使用方式：
 * POST /api/comfyui
 * Body: { action: "text2img", params: { prompt: "..." } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  checkComfyUIHealth,
  getComfyUISystemInfo,
  getQueueStatus,
  textToImage,
  dunhuangTextToImage,
  refineImage,
  removeBackground,
  upscaleImage,
  removeWatermark,
  sketchToRealistic,
  reliefEffect,
  blendImages,
  comfyuiConfig,
} from '@/lib/comfyui-service';
import { getWorkflowConfig, isWorkflowConfigured, workflowConfigs } from '@/config/comfyui-workflows';
import { unauthorized, badRequest, serviceUnavailable, internalError } from '@/lib/api-response';

// Action 处理器映射
const actionHandlers: Record<string, (params: any) => Promise<any>> = {
  'health': async () => checkComfyUIHealth(),
  'systemInfo': async () => getComfyUISystemInfo(),
  'queueStatus': async () => getQueueStatus(),
  
  // 图片生成
  'text2img': async (params) => textToImage(params),
  'dunhuang': async (params) => dunhuangTextToImage({ prompt: params.prompt, width: params.width, height: params.height, count: params.count }),
  
  // 图片处理
  'refine': async (params) => refineImage(params.imageUrl),
  'removebg': async (params) => removeBackground(params.imageUrl),
  'upscale': async (params) => upscaleImage(params.imageUrl, params.scale),
  'watermark': async (params) => removeWatermark(params.imageUrl),
  'sketch': async (params) => sketchToRealistic(params.imageUrl),
  'relief': async (params) => reliefEffect(params.imageUrl),
  'blend': async (params) => blendImages(params.imageUrls, params.mode),
  
  // 工作流配置
  'getWorkflowConfig': async (params) => getWorkflowConfig(params.feature),
  'isConfigured': async (params) => isWorkflowConfigured(params.feature),
  'listConfigured': async () => {
    const configured: string[] = [];
    for (const id of Object.keys(workflowConfigs)) {
      if (isWorkflowConfigured(id)) configured.push(id);
    }
    return configured;
  },
};

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { action, params = {} } = body;

    if (!action) {
      return badRequest('缺少 action 参数');
    }

    // 检查 ComfyUI 是否启用
    if (!comfyuiConfig.enabled) {
      return serviceUnavailable('ComfyUI 未启用，请设置 COMFYUI_ENABLED=true');
    }

    // 查找处理器
    const handler = actionHandlers[action];
    if (!handler) {
      return NextResponse.json({
        success: false,
        error: `未知的 action: ${action}`,
        availableActions: Object.keys(actionHandlers),
      }, { status: 400 });
    }

    // 执行
    const result = await handler(params);

    // 统一响应格式
    if (action === 'health' || action === 'isConfigured') {
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'getWorkflowConfig' || action === 'listConfigured' || action === 'queueStatus' || action === 'systemInfo') {
      return NextResponse.json({ success: true, data: result });
    }

    // 返回生成结果
    return NextResponse.json(result);

  } catch (err: unknown) {
    return internalError(err, '服务器错误');
  }
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();
  // 返回可用操作列表
  return NextResponse.json({
    success: true,
    availableActions: Object.keys(actionHandlers),
    workflowFeatures: [
      'text2img',
      'dunhuang',
      'refine',
      'removebg',
      'upscale',
      'watermark',
      'sketch',
      'relief',
      'blend',
    ],
  });
}
