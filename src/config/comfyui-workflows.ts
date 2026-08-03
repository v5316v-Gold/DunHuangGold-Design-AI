/**
 * ComfyUI 工作流配置
 * 
 * 使用说明：
 * 1. 在 ComfyUI 中创建并验证每个工作流
 * 2. 保存工作流后，记录其 Prompt ID 或完整 JSON
 * 3. 在本配置文件中填入对应的工作流信息
 * 4. 重启服务即可生效
 */

// ComfyUI 连接配置
export const comfyuiConfig = {
  url: process.env.COMFYUI_URL || 'http://127.0.0.1:8188',
  enabled: process.env.COMFYUI_ENABLED === 'true',
  timeout: 120000,  // 超时时间（毫秒）
  pollInterval: 2000,  // 轮询间隔（毫秒）
};

// ==================== 工作流映射表 ====================

export interface WorkflowConfig {
  workflowId: string;      // ComfyUI 中的工作流 ID / Prompt ID
  nodeMapping: {
    // 输入节点映射
    prompt?: string;      // 正向提示词节点
    negativePrompt?: string;  // 负向提示词节点
    image?: string;       // 输入图片节点
    image1?: string;     // 图片1节点（多图融合）
    image2?: string;     // 图片2节点（多图融合）
    depthMap?: string;    // 深度图节点
    width?: string;        // 宽度节点
    height?: string;       // 高度节点
    model?: string;        // 模型节点
    seed?: string;         // 种子节点
    steps?: string;        // 步数节点
    cfg?: string;          // CFG 节点
    sampler?: string;      // 采样器节点
    denoise?: string;     // 去噪强度节点
    // 输出节点映射
    outputImage?: string;  // 输出图片节点
  };
  defaultParams?: {
    width?: number;
    height?: number;
    steps?: number;
    cfg?: number;
    sampler?: string;
    model?: string;
    denoise?: number;     // 去噪强度默认值
  };
  description?: string;   // 功能描述
}

// 工作流 ID 映射（老祖填入 ComfyUI 验证后的工作流 ID）
export const workflowConfigs: Record<string, WorkflowConfig> = {
  
  // ========== 文生图 ==========
  'text2img': {
    workflowId: '9ae6082b-c7f4-433c-9971-7a8f65a3ea65',  // Z-Image-Turbo z-image_turbo.json
    nodeMapping: {
      prompt: '45',       // CLIPTextEncode - 正向提示词
      width: '41',        // EmptySD3LatentImage - 宽度
      height: '41',       // EmptySD3LatentImage - 高度
      model: '47',        // ModelSamplingAuraFlow - 模型
      seed: '44',         // KSampler - 种子
      steps: '44',        // KSampler - 步数
      cfg: '44',          // KSampler - CFG
      sampler: '44',      // KSampler - 采样器
      denoise: '44',      // KSampler - 去噪强度
      outputImage: '9',   // SaveImage - 输出
    },
    defaultParams: {
      width: 1024,
      height: 1024,
      steps: 25,
      cfg: 7.0,
      sampler: 'euler',
      denoise: 1.0,
    },
    description: '文本生成图片 - Z-Image-Turbo 文生图',
  },

  // ========== 图片精修 ==========
  'refine': {
    workflowId: '',  // TODO: 老祖在 ComfyUI 验证后填入
    nodeMapping: {
      prompt: '4',       // CLIPTextEncode - 正向提示词
      negativePrompt: '6', // CLIPTextEncode - 负向提示词
      image: '3',        // LoadImage - 输入图片
      model: '5',        // CheckpointLoader - 模型
      seed: '8',         // KSampler - 种子
      steps: '8',        // KSampler - 步数
      cfg: '8',          // KSampler - CFG
      outputImage: '10', // SaveImage - 输出
    },
    defaultParams: {
      steps: 20,
      cfg: 7.0,
    },
    description: '图片精修 - Img2Img 风格转换',
  },

  // ========== 背景移除 ==========
  'removebg': {
    workflowId: '',  // TODO: 老祖在 ComfyUI 验证后填入
    nodeMapping: {
      image: '1',        // LoadImage - 输入图片
      outputImage: '4',  // SaveImage - 输出
    },
    description: '移除背景 - RMBG 模型',
  },

  // ========== 图片放大 ==========
  'upscale': {
    workflowId: '',  // TODO: 老祖在 ComfyUI 验证后填入
    nodeMapping: {
      image: '1',        // LoadImage - 输入图片
      outputImage: '3',  // SaveImage - 输出
    },
    defaultParams: {
      // 放大倍数等参数
    },
    description: '超分辨率放大 - RealESRGAN / SD Upscale',
  },

  // ========== 敦煌浮雕效果 ==========
  'relief': {
    workflowId: '',  // TODO: 老祖在 ComfyUI 验证后填入
    nodeMapping: {
      image: '1',        // LoadImage - 输入图片
      outputImage: '4',  // SaveImage - 输出
    },
    description: '敦煌浮雕效果 - 颜色调整',
  },

  // ========== 素描转真实 ==========
  'sketch': {
    workflowId: '',  // TODO: 老祖在 ComfyUI 验证后填入
    nodeMapping: {
      prompt: '2',       // CLIPTextEncode - 正向提示词
      negativePrompt: '3', // CLIPTextEncode - 负向提示词
      image: '1',        // LoadImage - 输入图片
      model: '5',        // CheckpointLoader - 模型
      seed: '6',         // KSampler - 种子
      outputImage: '8',  // SaveImage - 输出
    },
    description: '素描转真实图片',
  },

  // ========== 多图融合 ==========
  'blend': {
    workflowId: '',  // TODO: 老祖在 ComfyUI 验证后填入
    nodeMapping: {
      image1: '1',       // LoadImage - 图片1
      image2: '2',       // LoadImage - 图片2
      outputImage: '4',  // SaveImage - 输出
    },
    description: '多图融合 - ImageBlend',
  },

  // ========== 去除水印 ==========
  'watermark': {
    workflowId: '',  // TODO: 老祖在 ComfyUI 验证后填入
    nodeMapping: {
      image: '1',        // LoadImage - 输入图片
      outputImage: '3',  // SaveImage - 输出
    },
    description: '去除水印 - Inpaint',
  },

  // ========== 线稿生图 ==========
  'lineart': {
    workflowId: '',  // TODO: 老祖在 ComfyUI 验证后填入
    nodeMapping: {
      prompt: '3',       // CLIPTextEncode - 正向提示词
      image: '1',        // LoadImage - 输入线稿
      outputImage: '8',  // SaveImage - 输出
    },
    description: '线稿生成真实图片 - ControlNet Lineart',
  },

  // ========== 深度图转3D ==========
  'depth2img': {
    workflowId: '',  // TODO: 老祖在 ComfyUI 验证后填入
    nodeMapping: {
      prompt: '3',       // CLIPTextEncode - 正向提示词
      depthMap: '1',     // LoadImage - 深度图
      outputImage: '10', // SaveImage - 输出
    },
    description: '深度图转图片 - Depth Map + SD',
  },

};

// ==================== 快捷配置函数 ====================

/**
 * 根据功能 ID 获取工作流配置
 */
export function getWorkflowConfig(featureId: string): WorkflowConfig | null {
  return workflowConfigs[featureId] || null;
}

/**
 * 检查工作流是否已配置
 */
export function isWorkflowConfigured(featureId: string): boolean {
  const config = workflowConfigs[featureId];
  return config?.workflowId !== '' && config?.workflowId !== undefined;
}

/**
 * 获取所有已配置的工作流列表
 */
export function getConfiguredWorkflows(): string[] {
  return Object.entries(workflowConfigs)
    .filter(([_, config]) => isWorkflowConfigured(_))
    .map(([id, _]) => id);
}
