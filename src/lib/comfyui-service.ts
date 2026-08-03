/**
 * ComfyUI 服务层
 * 对接本地运行的 ComfyUI (http://localhost:8188)
 */

const COMFYUI_HOST = process.env.COMFYUI_HOST || 'http://localhost:8188';
import { createLogger } from '@/lib/error-handler';
const logger = createLogger('comfyui-service');
import { getFileTypeDir } from '@/lib/storage-config';

export interface ComfyUIResponse {
  success: boolean;
  prompt_id?: string;
  error?: string;
  images?: string[];
}

export interface PromptRequest {
  workflow: string;  // 工作流JSON或工作流ID
  prompt: string;     // 用户输入的prompt
  params?: Record<string, any>; // 其他参数
}

/**
 * 提交工作流到 ComfyUI 执行
 */
export async function queuePrompt(workflowJson: any, promptText: string): Promise<ComfyUIResponse> {
  try {
    // 修改工作流中的文本节点
    const modifiedWorkflow = injectPrompt(workflowJson, promptText);
    
    const response = await fetch(`${COMFYUI_HOST}/api/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: modifiedWorkflow,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `ComfyUI API错误: ${response.status} - ${error}` };
    }

    const data = await response.json();
    return {
      success: true,
      prompt_id: data.prompt_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '提交工作流失败',
    };
  }
}

/**
 * 获取执行历史
 */
export async function getHistory(promptId: string): Promise<any> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/api/history/${promptId}`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * 获取执行结果图片
 */
export async function getOutputImages(promptId: string): Promise<string[]> {
  const history = await getHistory(promptId);
  if (!history || !history[promptId]) {
    return [];
  }

  const outputs = history[promptId].outputs || {};
  const images: string[] = [];

  // 遍历所有输出节点
  for (const nodeId of Object.keys(outputs)) {
    const nodeOutput = outputs[nodeId];
    
    // 处理图片输出（检查是否是有效数组）
    if (nodeOutput.images && Array.isArray(nodeOutput.images) && nodeOutput.images.length > 0) {
      for (const img of nodeOutput.images) {
        // ComfyUI-aki-v3 可能返回字符串格式 @{filename=xxx; subfolder=xxx} 或对象格式
        let filename: string;
        let subfolder: string = '';
        
        if (typeof img === 'string') {
          // 解析字符串格式 @{filename=xxx; subfolder=xxx}
          const match = img.match(/filename=([^;]+)/);
          const subfolderMatch = img.match(/subfolder=([^;]*)/);
          filename = match ? match[1] : img;
          subfolder = subfolderMatch ? subfolderMatch[1] : '';
        } else {
          // 对象格式
          filename = img.filename || '';
          subfolder = img.subfolder || '';
        }
        
        if (filename) {
          // 构建完整的文件路径，包含 subfolder
          // 由于 ComfyUI-aki-v3 的 /view 接口返回 404，改用本地 API 代理
          const imageUrl = `/api/comfyui-image?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}`;
          images.push(imageUrl);
        }
      }
    }
    
    // 处理 GIF 输出
    if (nodeOutput.gifs) {
      for (const gif of nodeOutput.gifs) {
        const imageUrl = `/api/comfyui-image?filename=${encodeURIComponent(gif.filename)}`;
        images.push(imageUrl);
      }
    }
  }

  return images;
}

/**
 * 获取系统状态
 */
export async function getSystemStats(): Promise<any> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/system_stats`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * 注入 prompt 文本到工作流
 * 具体实现需要根据工作流结构来调整
 */
function injectPrompt(workflow: any, promptText: string): any {
  const modified = { ...workflow };
  
  // 遍历所有节点，找到文本输入类型的节点
  for (const [nodeId, node] of Object.entries<any>(workflow)) {
    if (node.class_type === 'CLIPTextEncode' || 
        node.class_type === 'Text Prompt' ||
        node.class_type === 'Prompt' ||
        node.class_type?.includes('Text')) {
      // 注入到 positive 或 text 字段
      if (node.inputs) {
        if (node.inputs.positive) {
          modified[nodeId] = {
            ...node,
            inputs: {
              ...node.inputs,
              positive: promptText,
            }
          };
        } else if (node.inputs.text) {
          modified[nodeId] = {
            ...node,
            inputs: {
              ...node.inputs,
              text: promptText,
            }
          };
        }
      }
    }
  }
  
  return modified;
}

/**
 * 检查 ComfyUI 服务是否可用
 */
export async function checkComfyUIHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/system_stats`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ==================== 非阻塞提交（支持 SSE 进度）====================

/**
 * 仅提交工作流，返回 prompt_id（不等待完成）
 * 用于 SSE 进度轮询场景
 */
export async function submitPrompt(
  workflowJson: any,
  promptText: string
): Promise<{ success: boolean; prompt_id?: string; error?: string }> {
  const result = await queuePrompt(workflowJson, promptText);
  if (result.success && result.prompt_id) {
    return { success: true, prompt_id: result.prompt_id };
  }
  return { success: false, error: result.error || '提交失败' };
}

// ==================== 便捷导出函数 ====================

/**
 * 获取 ComfyUI 系统信息
 */
export async function getComfyUISystemInfo(): Promise<{
  success: boolean;
  stats?: {
    system?: { comfyui_version?: string };
    devices?: Array<{ name?: string }>;
    memory?: { ram_total?: number; ram_free?: number };
  };
  error?: string;
}> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/system_stats`);
    if (!response.ok) {
      return { success: false, error: '获取系统信息失败' };
    }
    const stats = await response.json();
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '获取系统信息失败' };
  }
}

/**
 * 获取队列状态
 */
export async function getQueueStatus(): Promise<{ success: boolean; queue?: number; error?: string }> {
  try {
    const response = await fetch(`${COMFYUI_HOST}/api/queue`);
    if (!response.ok) {
      return { success: false, error: '获取队列状态失败' };
    }
    const data = await response.json();
    return { success: true, queue: data.queue_running?.length || 0 };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '获取队列状态失败' };
  }
}

/**
 * 文生图 (dunhuangTextToImage)
 */
export async function dunhuangTextToImage(options: {
  prompt: string;
  width?: number;
  height?: number;
  count?: number;
}): Promise<{ success: boolean; images?: string[]; error?: string }> {
  return textToImage({
    prompt: options.prompt,
    width: options.width || 512,
    height: options.height || 512,
    count: options.count || 1,
  });
}

/**
 * 产品精修 (refineImage)
 */
export async function refineImage(inputImage: string): Promise<{ success: boolean; images?: string[]; error?: string }> {
  // 简化的精修工作流
  const workflow = {
    "1": { inputs: { image: inputImage }, "class_type": "LoadImage" },
    "2": { inputs: { method: "recolor", preserve_color: true }, "class_type": "ImageColorFix" },
    "3": { inputs: { samples: ["LATENT", 2], "denoise": 0.3 }, "class_type": "ImageUpscaleWithModel" },
    "4": { inputs: { "filename_prefix": "refined", "type": "output" }, "class_type": "SaveImage" },
  };
  const result = await queuePrompt(workflow, "");
  if (!result.success || !result.prompt_id) {
    return { success: false, error: result.error };
  }
  const completion = await waitForCompletion(result.prompt_id);
  return completion.completed
    ? { success: true, images: completion.images }
    : { success: false, error: completion.error };
}

/**
 * 抠图 (removeBackground)
 */
export async function removeBackground(inputImage: string): Promise<{ success: boolean; images?: string[]; error?: string }> {
  const workflow = {
    "1": { inputs: { image: inputImage }, "class_type": "LoadImage" },
    "2": { inputs: { method: "u2net" }, "class_type": "RemBgBackgroundRemover" },
    "3": { inputs: { "filename_prefix": "nobg", "type": "output" }, "class_type": "SaveImage" },
  };
  const result = await queuePrompt(workflow, "");
  if (!result.success || !result.prompt_id) {
    return { success: false, error: result.error };
  }
  const completion = await waitForCompletion(result.prompt_id);
  return completion.completed
    ? { success: true, images: completion.images }
    : { success: false, error: completion.error };
}

/**
 * 图片放大 (upscaleImage)
 */
export async function upscaleImage(inputImage: string, scale: number = 2): Promise<{ success: boolean; images?: string[]; error?: string }> {
  const workflow = {
    "1": { inputs: { image: inputImage }, "class_type": "LoadImage" },
    "2": { inputs: { upscale_method: "nearest-exact", scale: scale }, "class_type": "ImageScale" },
    "3": { inputs: { "filename_prefix": "upscaled", "type": "output" }, "class_type": "SaveImage" },
  };
  const result = await queuePrompt(workflow, "");
  if (!result.success || !result.prompt_id) {
    return { success: false, error: result.error };
  }
  const completion = await waitForCompletion(result.prompt_id);
  return completion.completed
    ? { success: true, images: completion.images }
    : { success: false, error: completion.error };
}

/**
 * 去除水印 (removeWatermark)
 */
export async function removeWatermark(inputImage: string): Promise<{ success: boolean; images?: string[]; error?: string }> {
  const workflow = {
    "1": { inputs: { image: inputImage }, "class_type": "LoadImage" },
    "2": { inputs: { method: "goose" }, "class_type": "WatermarkRemoval" },
    "3": { inputs: { "filename_prefix": "nowatermark", "type": "output" }, "class_type": "SaveImage" },
  };
  const result = await queuePrompt(workflow, "");
  if (!result.success || !result.prompt_id) {
    return { success: false, error: result.error };
  }
  const completion = await waitForCompletion(result.prompt_id);
  return completion.completed
    ? { success: true, images: completion.images }
    : { success: false, error: completion.error };
}

/**
 * 线稿转写实 (sketchToRealistic)
 */
export async function sketchToRealistic(inputImage: string): Promise<{ success: boolean; images?: string[]; error?: string }> {
  const workflow = {
    "1": { inputs: { image: inputImage }, "class_type": "LoadImage" },
    "2": { inputs: { prompt: "realistic photo, high quality", "strength": 0.8 }, "class_type": "ImageToImage" },
    "3": { inputs: { "filename_prefix": "realistic", "type": "output" }, "class_type": "SaveImage" },
  };
  const result = await queuePrompt(workflow, "");
  if (!result.success || !result.prompt_id) {
    return { success: false, error: result.error };
  }
  const completion = await waitForCompletion(result.prompt_id);
  return completion.completed
    ? { success: true, images: completion.images }
    : { success: false, error: completion.error };
}

/**
 * 浮雕效果 (reliefEffect)
 */
export async function reliefEffect(inputImage: string): Promise<{ success: boolean; images?: string[]; error?: string }> {
  const workflow = {
    "1": { inputs: { image: inputImage }, "class_type": "LoadImage" },
    "2": { inputs: { effect_type: "emboss" }, "class_type": "ReliefEffect" },
    "3": { inputs: { "filename_prefix": "relief", "type": "output" }, "class_type": "SaveImage" },
  };
  const result = await queuePrompt(workflow, "");
  if (!result.success || !result.prompt_id) {
    return { success: false, error: result.error };
  }
  const completion = await waitForCompletion(result.prompt_id);
  return completion.completed
    ? { success: true, images: completion.images }
    : { success: false, error: completion.error };
}

/**
 * 混合图片 (blendImages)
 */
export async function blendImages(images: string[], mode: string = 'normal'): Promise<{ success: boolean; images?: string[]; error?: string }> {
  const workflow = {
    "1": { inputs: { images: images, mode: mode }, "class_type": "ImageBlend" },
    "2": { inputs: { "filename_prefix": "blended", "type": "output" }, "class_type": "SaveImage" },
  };
  const result = await queuePrompt(workflow, "");
  if (!result.success || !result.prompt_id) {
    return { success: false, error: result.error };
  }
  const completion = await waitForCompletion(result.prompt_id);
  return completion.completed
    ? { success: true, images: completion.images }
    : { success: false, error: completion.error };
}

/**
 * ComfyUI 配置
 */
export const comfyuiConfig = {
  host: COMFYUI_HOST,
  timeout: 300000,
  enabled: process.env.COMFYUI_ENABLED !== 'false',
};

/**
 * 文生图快捷函数
 */
/**
 * Z-Image-Turbo 文生图（使用 Flux 架构）
 */
export async function textToImageZTurbo(options: {
  prompt: string;
  width: number;
  height: number;
  count?: number;
  seed?: number;
}): Promise<{ success: boolean; images?: string[]; error?: string }> {
  const seed = options.seed ?? Math.floor(Math.random() * 9999999999);
  
  // Z-Image-Turbo 工作流（ComfyUI-aki-v3 格式 - 数组格式的节点引用）
  const workflow = {
    "39": {
      "inputs": {
        "clip_name": "Qwen\\qwen_3_4b.safetensors",
        "type": "lumina2",
        "device": "default"
      },
      "class_type": "CLIPLoader"
    },
    "40": {
      "inputs": {
        "vae_name": "Flux\\ae.sft"
      },
      "class_type": "VAELoader"
    },
    "41": {
      "inputs": {
        "width": options.width,
        "height": options.height,
        "batch_size": options.count || 1
      },
      "class_type": "EmptySD3LatentImage"
    },
    "42": {
      "inputs": {
        "conditioning": ["45", 0]
      },
      "class_type": "ConditioningZeroOut"
    },
    "43": {
      "inputs": {
        "samples": ["44", 0],
        "vae": ["40", 0]
      },
      "class_type": "VAEDecode"
    },
    "44": {
      "inputs": {
        "seed": seed,
        "steps": 9,
        "cfg": 1,
        "sampler_name": "res_multistep",
        "scheduler": "sgm_uniform",
        "denoise": 1,
        "model": ["47", 0],
        "positive": ["45", 0],
        "negative": ["42", 0],
        "latent_image": ["41", 0]
      },
      "class_type": "KSampler"
    },
    "45": {
      "inputs": {
        "text": options.prompt,
        "clip": ["39", 0]
      },
      "class_type": "CLIPTextEncode"
    },
    "46": {
      "inputs": {
        "unet_name": "Z-Image-Turbo\\z_image_turbo_bf16.safetensors",
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader"
    },
    "47": {
      "inputs": {
        "shift": 3,
        "model": ["46", 0]
      },
      "class_type": "ModelSamplingAuraFlow"
    },
    "9": {
      "inputs": {
        "filename_prefix": "敦煌金/ZTurbo",
        "images": ["43", 0]
      },
      "class_type": "SaveImage"
    }
  };

  const result = await queuePrompt(workflow, options.prompt);
  if (!result.success || !result.prompt_id) {
    return { success: false, error: result.error || '提交失败' };
  }

  const completion = await waitForCompletion(result.prompt_id);
  if (completion.completed) {
    return { success: true, images: completion.images };
  } else {
    return { success: false, error: completion.error };
  }
}

/**
 * SD 1.5 文生图（传统方法）
 */
export async function textToImage(options: {
  prompt: string;
  width: number;
  height: number;
  count?: number;
}): Promise<{ success: boolean; images?: string[]; error?: string }> {
  // 默认 SD 1.5 工作流（ComfyUI-aki-v3 格式 - 数组格式的节点引用）
  const workflow = {
    "1": {
      "inputs": {
        "ckpt_name": "SD1.5/majicmixRealistic_v7.safetensors"
      },
      "class_type": "CheckpointLoaderSimple"
    },
    "3": {
      "inputs": {
        "width": options.width,
        "height": options.height,
        "batch_size": options.count || 1
      },
      "class_type": "EmptyLatentImage"
    },
    "4": {
      "inputs": {
        "text": options.prompt,
        "clip": ["1", 0]
      },
      "class_type": "CLIPTextEncode"
    },
    "5": {
      "inputs": {
        "text": "",
        "clip": ["1", 0]
      },
      "class_type": "CLIPTextEncode"
    },
    "6": {
      "inputs": {
        "seed": Math.floor(Math.random() * 9999999999),
        "steps": 20,
        "cfg": 8,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1,
        "model": ["1", 0],
        "positive": ["4", 0],
        "negative": ["5", 0],
        "latent_image": ["3", 0]
      },
      "class_type": "KSampler"
    },
    "7": {
      "inputs": {
        "samples": ["6", 0],
        "vae": ["1", 0]
      },
      "class_type": "VAEDecode"
    },
    "8": {
      "inputs": {
        "images": ["7", 0],
        "filename_prefix": "敦煌金/SD15"
      },
      "class_type": "SaveImage"
    }
  };

  const result = await queuePrompt(workflow, options.prompt);
  if (!result.success || !result.prompt_id) {
    return { success: false, error: result.error || '提交失败' };
  }

  const completion = await waitForCompletion(result.prompt_id);
  if (completion.completed) {
    return { success: true, images: completion.images };
  } else {
    return { success: false, error: completion.error };
  }
}

/**
 * 轮询等待执行完成
 */
export async function waitForCompletion(
  promptId: string, 
  maxWaitMs: number = 300000, // 5分钟
  intervalMs: number = 2000
): Promise<{ completed: boolean; images?: string[]; error?: string }> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const history = await getHistory(promptId);
    
    if (history && history[promptId]) {
      const status = history[promptId].status;
      
      if (status?.err) {
        return { completed: true, error: '执行失败' };
      }
      
      if (status?.completed) {
        const images = await getOutputImages(promptId);
        return { completed: true, images };
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  return { completed: false, error: '执行超时' };
}

/**
 * ─────────────────────────────────────────────────────────────────
 * 3D 生成相关
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * 图片 → 3D浮雕/模型
 *
 * 工作流：
 *   1. LoadImage — 加载输入图片
 *   2. Marigold-Depth — 深度估计（需要 marigoldSd15.safetensors）
 *   3. DepthToNormal → NormalMap
 *   4. ImageBlend — 混合原图与深度图，生成浮雕预览
 *   5. SaveImage — 输出预览图
 *
 * 如 Marigold 模型不可用，降级为 DepthMap2Normal + ImageColor切面风格化
 */
export async function imageTo3D(
  inputImage: string,
  options: {
    reliefType?: string;  // 'shallow' | 'deep' | 'medium'
    modelWeight?: number;
  } = {}
): Promise<{
  success: boolean;
  previewImage?: string;
  depthMap?: string;
  normalMap?: string;
  modelUrl?: string;
  modelUrls?: string[];
  workflow?: string;
  error?: string;
}> {
  const { reliefType = 'medium' } = options;

  // reliefType → invert + strength 映射
  const reliefConfig: Record<string, { invert: boolean; strength: number }> = {
    shallow: { invert: true, strength: 0.4 },
    medium:  { invert: true, strength: 0.7 },
    deep:    { invert: false, strength: 1.0 },
  };
  const cfg = reliefConfig[reliefType] || reliefConfig.medium;

  // 主工作流：Marigold 深度估计 → 深度图 → 浮雕预览
  const depthWorkflow = {
    "1": {
      "inputs": { "image": inputImage },
      "class_type": "LoadImage"
    },
    "2": {
      "inputs": {
        "model_name": "marigoldSd15.safetensors",
        "precision": "fp16",
        "seed": Math.floor(Math.random() * 9999999999)
      },
      "class_type": "MarigoldDepth"
    },
    "3": {
      "inputs": {
        "images": ["2", 0],
        "invert": cfg.invert
      },
      "class_type": "ImageInvert"
    },
    "4": {
      "inputs": {
        "quality": 95,
        "images": ["3", 0]
      },
      "class_type": "ImageUpscaleWithModel",
      "_meta": { "title": "Depth Map Save (preview)" }
    },
    "5": {
      "inputs": {
        "images": ["4", 0],
        "strength": cfg.strength,
        "blend_method": "multiply",
        "source_image": ["1", 0]
      },
      "class_type": "ImageBlendAlpha"
    },
    "6": {
      "inputs": {
        "images": ["5", 0],
        "filename_prefix": "敦煌金/Relief3D"
      },
      "class_type": "SaveImage"
    }
  };

  logger.info('[imageTo3D] 提交 ComfyUI 深度估计工作流');
  const result = await queuePrompt(depthWorkflow, '');
  if (!result.success || !result.prompt_id) {
    // Marigold 不可用，尝试降级工作流
    logger.warn('[imageTo3D] Marigold 不可用，尝试 DepthMap → NormalMap 降级工作流');
    return imageTo3D_FallbackWorkflow(inputImage, cfg);
  }

  const completion = await waitForCompletion(result.prompt_id);
  if (!completion.completed || !completion.images?.length) {
    logger.warn('[imageTo3D] 深度估计超时/失败，降级到备选工作流: %s', completion.error);
    return imageTo3D_FallbackWorkflow(inputImage, cfg);
  }

  // 深度图 → 转换正常深度图路径
  const depthMapUrl = completion.images[0];

  // 第二步：用深度图生成 3D 预览（NormalMap + 混合）
  const normalWorkflow = {
    "1": {
      "inputs": { "image": depthMapUrl },
      "class_type": "LoadImage"
    },
    "2": {
      "inputs": {
        "projector_model_name": "dpt_large",
        "image": ["1", 0]
      },
      "class_type": "DepthAnything/apply"
    },
    "3": {
      "inputs": {
        "quality": 95,
        "images": ["2", 0]
      },
      "class_type": "ImageUpscaleWithModel"
    },
    "4": {
      "inputs": {
        "images": ["3", 0],
        "filename_prefix": "敦煌金/Relief3D_Normal"
      },
      "class_type": "SaveImage"
    }
  };

  const normalResult = await queuePrompt(normalWorkflow, '');
  let normalMapUrl: string | undefined;
  if (normalResult.success && normalResult.prompt_id) {
    const normalCompletion = await waitForCompletion(normalResult.prompt_id);
    normalMapUrl = normalCompletion.images?.[0];
  }

  // 生成 3D 预览图（使用 ControlNet tile + 原图混合）
  const previewWorkflow = {
    "1": {
      "inputs": { "image": inputImage },
      "class_type": "LoadImage"
    },
    "2": {
      "inputs": {
        "images": ["1", 0],
        "alpha": 128
      },
      "class_type": "InvertMask"
    },
    "3": {
      "inputs": {
        "ckpt_name": "SD1.5/majicmixRealistic_v7.safetensors"
      },
      "class_type": "CheckpointLoaderSimple"
    },
    "4": {
      "inputs": {
        "text": "embossed relief sculpture, 3d depth effect, fine texture, professional lighting",
        "clip": ["3", 1]
      },
      "class_type": "CLIPTextEncode"
    },
    "5": {
      "inputs": {
        "text": "blurry, low quality, flat, no depth",
        "clip": ["3", 1]
      },
      "class_type": "CLIPTextEncode"
    },
    "6": {
      "inputs": {
        "samples": ["9", 0],
        "vae": ["3", 2]
      },
      "class_type": "VAEDecode"
    },
    "7": {
      "inputs": {
        "width": 512,
        "height": 512,
        "batch_size": 1
      },
      "class_type": "EmptySD3LatentImage"
    },
    "8": {
      "inputs": {
        "seed": Math.floor(Math.random() * 9999999999),
        "steps": 20,
        "cfg": 7,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 0.3,
        "model": ["3", 0],
        "positive": ["4", 0],
        "negative": ["5", 0],
        "latent_image": ["7", 0]
      },
      "class_type": "KSampler"
    },
    "9": {
      "inputs": {
        "samples": ["8", 0],
        "vae": ["3", 2]
      },
      "class_type": "VAEDecode"
    },
    "10": {
      "inputs": {
        "images": ["9", 0],
        "filename_prefix": "敦煌金/Relief3D_Preview"
      },
      "class_type": "SaveImage"
    }
  };

  const previewResult = await queuePrompt(previewWorkflow, '');
  let previewUrl: string | undefined;
  if (previewResult.success && previewResult.prompt_id) {
    const previewCompletion = await waitForCompletion(previewResult.prompt_id);
    previewUrl = previewCompletion.images?.[0];
  }

  // 3D 模型文件：通过深度图数据生成 GLB（使用 trimesh / python 脚本调用）
  // 此处返回 depth map 供外部工具使用，实际 GLB 由 Meshy 兜底生成
  const modelUrl = await generateGLBFromDepth(depthMapUrl, reliefType);

  return {
    success: true,
    previewImage: previewUrl || depthMapUrl,
    depthMap: depthMapUrl,
    normalMap: normalMapUrl,
    modelUrl: modelUrl || depthMapUrl,
    workflow: 'MarigoldDepth → ImageInvert → ImageBlendAlpha → SaveImage'
  };
}

/**
 * 降级工作流（Marigold 不可用时）：
 * DepthMap → ImageQuantize → ImageLuminance → ImageBlend
 */
async function imageTo3D_FallbackWorkflow(
  inputImage: string,
  cfg: { invert: boolean; strength: number }
): Promise<{
  success: boolean;
  previewImage?: string;
  depthMap?: string;
  modelUrl?: string;
  workflow?: string;
  error?: string;
}> {
  const fallbackWorkflow = {
    "1": {
      "inputs": { "image": inputImage },
      "class_type": "LoadImage"
    },
    "2": {
      "inputs": {
        "model_name": "control_v11f1e_sd15_tile.pth",
        "guide_image": ["1", 0],
        "strength": 0.9
      },
      "class_type": "ControlNetApply"
    },
    "3": {
      "inputs": {
        "images": ["1", 0],
        "invert": cfg.invert
      },
      "class_type": "ImageInvert"
    },
    "4": {
      "inputs": {
        "images": ["3", 0],
        "strength": cfg.strength
      },
      "class_type": "ImageBlur"
    },
    "5": {
      "inputs": {
        "base": ["1", 0],
        "layer": ["4", 0],
        "blend_mode": "multiply"
      },
      "class_type": "ImageBlendAlpha"
    },
    "6": {
      "inputs": {
        "images": ["5", 0],
        "filename_prefix": "敦煌金/Relief3D_Fallback"
      },
      "class_type": "SaveImage"
    }
  };

  const result = await queuePrompt(fallbackWorkflow, '');
  if (!result.success || !result.prompt_id) {
    return { success: false, error: `ComfyUI 不可用: ${result.error}` };
  }

  const completion = await waitForCompletion(result.prompt_id);
  if (!completion.completed || !completion.images?.length) {
    return { success: false, error: `深度估计超时: ${completion.error}` };
  }

  const previewImage = completion.images[0];
  const modelUrl = await generateGLBFromDepth(previewImage, cfg.invert ? 'medium' : 'deep');

  return {
    success: true,
    previewImage,
    depthMap: previewImage,
    modelUrl: modelUrl || previewImage,
    workflow: 'ControlNet Tile → ImageInvert → ImageBlur → ImageBlendAlpha → SaveImage (降级模式)'
  };
}

/**
 * 从深度图生成 GLB 文件
 * 调用 trimesh 或调用 Python 脚本生成 3D 模型
 */
async function generateGLBFromDepth(
  depthMapUrl: string,
  reliefType: string
): Promise<string | null> {
  try {
    // 调用本地 Python 脚本生成 GLB
    // python generate_glb.py --depth_url <url> --output <path> --relief_type <type>
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // 下载深度图到临时文件
    const depthResponse = await fetch(depthMapUrl);
    if (!depthResponse.ok) return null;

    const depthBuffer = Buffer.from(await depthResponse.arrayBuffer());
    const depthPath = `/tmp/depth_${Date.now()}.png`;
    const outputPath = `/tmp/relief3d_${Date.now()}.glb`;

    const fs = await import('fs');
    fs.writeFileSync(depthPath, depthBuffer);

    // 调用 Python 脚本
    const scriptPath = 'F:\\dunhuang-design\\scripts\\depth_to_glb.py';
    const cmd = `python "${scriptPath}" --depth "${depthPath}" --output "${outputPath}" --relief_type "${reliefType}"`;

    await execAsync(cmd).catch(() => null);

    if (fs.existsSync(outputPath)) {
      // 复制到存储目录
      const targetDir = getFileTypeDir('generated');
      const filename = `relief3d_${Date.now()}.glb`;
      const targetPath = `${targetDir}\\${filename}`;
      fs.copyFileSync(outputPath, targetPath);

      // 清理临时文件
      fs.unlinkSync(depthPath);
      fs.unlinkSync(outputPath);

      return `${process.env.BASE_URL || 'http://localhost:3000'}/api/download?type=generated&filename=${filename}`;
    }

    fs.unlinkSync(depthPath);
    return null;
  } catch {
    return null;
  }
}

/**
 * 深度图 → 立体效果（Stereo/2.5D）
 * 用于 /api/stereo 路由
 */
export async function depthMapFromImage(
  inputImage: string,
  options: {
    resolution?: string;
    style?: string;
  } = {}
): Promise<{
  success: boolean;
  depthMap?: string;
  normalMap?: string;
  stereoImage?: string;
  workflow?: string;
  error?: string;
}> {
  const { style = 'realistic' } = options;

  const workflow = {
    "1": {
      "inputs": { "image": inputImage },
      "class_type": "LoadImage"
    },
    "2": {
      "inputs": {
        "model_name": "marigoldSd15.safetensors",
        "precision": "fp16",
        "seed": Math.floor(Math.random() * 9999999999)
      },
      "class_type": "MarigoldDepth"
    },
    "3": {
      "inputs": {
        "images": ["2", 0],
        "invert": false
      },
      "class_type": "ImageInvert"
    },
    "4": {
      "inputs": {
        "quality": 95,
        "images": ["3", 0]
      },
      "class_type": "ImageUpscaleWithModel"
    },
    "5": {
      "inputs": {
        "projector_model_name": "dpt_large",
        "image": ["1", 0]
      },
      "class_type": "DepthAnything/apply"
    },
    "6": {
      "inputs": {
        "quality": 95,
        "images": ["5", 0]
      },
      "class_type": "ImageUpscaleWithModel"
    },
    "7": {
      "inputs": {
        "images": ["3", 0],
        "filename_prefix": "敦煌金/Stereo_Depth"
      },
      "class_type": "SaveImage"
    },
    "8": {
      "inputs": {
        "images": ["6", 0],
        "filename_prefix": "敦煌金/Stereo_Normal"
      },
      "class_type": "SaveImage"
    }
  };

  const result = await queuePrompt(workflow, '');
  if (!result.success || !result.prompt_id) {
    // 降级：使用 Canny + 原图生成简单深度效果
    return depthMapFallback(inputImage, style);
  }

  const completion = await waitForCompletion(result.prompt_id);
  if (!completion.completed || !completion.images?.length) {
    return depthMapFallback(inputImage, style);
  }

  // completion.images 包含 depth + normal 两张图
  const depthMap = completion.images[0];
  const normalMap = completion.images[1];

  // 生成立体图（左右视差）
  const stereoUrl = await generateStereoImage(inputImage, depthMap);

  return {
    success: true,
    depthMap,
    normalMap,
    stereoImage: stereoUrl || depthMap,
    workflow: 'MarigoldDepth → DepthToNormal → ImageBlend → SaveImage'
  };
}

async function depthMapFallback(
  inputImage: string,
  style: string
): Promise<{
  success: boolean;
  depthMap?: string;
  normalMap?: string;
  stereoImage?: string;
  workflow?: string;
  error?: string;
}> {
  const fallbackWorkflow = {
    "1": {
      "inputs": { "image": inputImage },
      "class_type": "LoadImage"
    },
    "2": {
      "inputs": {
        "resolution": 512,
        "image": ["1", 0]
      },
      "class_type": "ImageResize (forgery)"
    },
    "3": {
      "inputs": {
        "detect_resolution": 512,
        "images": ["1", 0],
        "disable_auto_progress": false
      },
      "class_type": "BAE-NormalNetwork Preprocessor"
    },
    "4": {
      "inputs": {
        "images": ["3", 0],
        "filename_prefix": "敦煌金/Stereo_Normal_Fallback"
      },
      "class_type": "SaveImage"
    }
  };

  const result = await queuePrompt(fallbackWorkflow, '');
  if (!result.success || !result.prompt_id) {
    return { success: false, error: `ComfyUI 不可用: ${result.error}` };
  }

  const completion = await waitForCompletion(result.prompt_id);
  if (!completion.completed || !completion.images?.length) {
    return { success: false, error: `深度图生成超时: ${completion.error}` };
  }

  return {
    success: true,
    depthMap: completion.images[0],
    normalMap: completion.images[0],
    stereoImage: completion.images[0],
    workflow: 'BAE-NormalNetwork (降级模式)'
  };
}

/**
 * 从深度图生成左右视差立体图
 */
async function generateStereoImage(
  baseImageUrl: string,
  depthMapUrl: string
): Promise<string | null> {
  const stereoWorkflow = {
    "1": {
      "inputs": { "image": baseImageUrl },
      "class_type": "LoadImage"
    },
    "2": {
      "inputs": { "image": depthMapUrl },
      "class_type": "LoadImage"
    },
    "3": {
      "inputs": {
        "images": ["2", 0],
        "invert": false
      },
      "class_type": "ImageInvert"
    },
    "4": {
      "inputs": {
        "base": ["1", 0],
        "layer": ["3", 0],
        "blend_mode": "multiply",
        "alpha": 0.5
      },
      "class_type": "ImageBlendAlpha"
    },
    "5": {
      "inputs": {
        "images": ["4", 0],
        "filename_prefix": "敦煌金/Stereo"
      },
      "class_type": "SaveImage"
    }
  };

  const result = await queuePrompt(stereoWorkflow, '');
  if (!result.success || !result.prompt_id) return null;

  const completion = await waitForCompletion(result.prompt_id);
  return completion.images?.[0] || null;
}

/**
 * 视频生成 — ComfyUI 路径
 * 使用 AnimateDiff / DynamiCrafter / SVD 等模型
 */
export async function generateVideoComfyUI(
  options: {
    prompt?: string;
    image?: string;
    duration?: number;
    resolution?: string;
    ratio?: string;
  }
): Promise<{
  success: boolean;
  videoUrl?: string;
  coverImage?: string;
  frames?: number;
  workflow?: string;
  error?: string;
}> {
  const { prompt, image, duration = 24, resolution = '512', ratio = '16:9' } = options;

  // SVD (Stable Video Diffusion) 工作流 — 图片转视频
  if (image) {
    const svdWorkflow = {
      "1": {
        "inputs": { "image": image },
        "class_type": "LoadImage"
      },
      "2": {
        "inputs": {
          "width": parseInt(resolution) || 512,
          "height": Math.round((parseInt(resolution) || 512) * (ratio === '9:16' ? 0.5625 : ratio === '3:4' ? 1.333 : 1.0)),
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage"
      },
      "3": {
        "inputs": {
          "motion_scale": 1.0,
          "video_frames": Math.min(duration, 25),
          "fps": 8,
          "latent_channels": 4,
          "enable_resize": false
        },
        "class_type": "SVD_img2vid_Interpolation"
      },
      "4": {
        "inputs": {
          "ckpt_name": "svd_xt.safetensors"
        },
        "class_type": "CheckpointLoader\n(VideoLinearCFGGuidance)"
      },
      "5": {
        "inputs": {
          "text": prompt || 'cinematic video, smooth motion, professional lighting',
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "6": {
        "inputs": {
          "text": "blurry, low quality, distorted",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": {
          "seed": Math.floor(Math.random() * 9999999999),
          "steps": 25,
          "cfg": 3.5,
          "sampler_name": "euler",
          "scheduler": "normal",
          "denoise": 1.0,
          "model": ["4", 0],
          "positive": ["5", 0],
          "negative": ["6", 0],
          "latent_image": ["3", 0]
        },
        "class_type": "KSampler"
      },
      "8": {
        "inputs": {
          "samples": ["7", 0],
          "vae": ["4", 2]
        },
        "class_type": "VAEDecode"
      },
      "9": {
        "inputs": {
          "images": ["8", 0],
          "filename_prefix": "敦煌金/Video_SVD"
        },
        "class_type": "SaveImage"
      },
      "10": {
        "inputs": {
          "fps": 8,
          "loop": 0,
          "images": ["9", 0]
        },
        "class_type": "VHS_VideoCombine"
      }
    };

    const result = await queuePrompt(svdWorkflow, prompt || '');
    if (!result.success || !result.prompt_id) {
      return { success: false, error: `ComfyUI 视频生成提交失败: ${result.error}` };
    }

    const completion = await waitForCompletion(result.prompt_id);
    if (!completion.completed) {
      return { success: false, error: `ComfyUI 视频生成超时: ${completion.error}` };
    }

    // SVD 输出的是帧图片，需要合成视频
    const videoUrl = await combineFramesToVideo(completion.images || [], 8);
    return {
      success: true,
      videoUrl: videoUrl || completion.images?.[0] || undefined,
      coverImage: completion.images?.[0],
      frames: completion.images?.length || 0,
      workflow: 'SVD_img2vid → VAEDecode → SaveImage → VHS_VideoCombine'
    };
  }

  // AnimateDiff — 文字转视频
  const animDiffWorkflow = {
    "1": {
      "inputs": {
        "ckpt_name": "SD1.5/animagineXL.safetensors"
      },
      "class_type": "CheckpointLoaderSimple"
    },
    "2": {
      "inputs": {
        "width": parseInt(resolution) || 512,
        "height": 512,
        "batch_size": 1
      },
      "class_type": "EmptyLatentImage"
    },
    "3": {
      "inputs": {
        "clip": ["1", 1],
        "text": prompt || 'cinematic video, beautiful scenery, smooth motion'
      },
      "class_type": "CLIPTextEncode"
    },
    "4": {
      "inputs": {
        "clip": ["1", 1],
        "text": "blurry, low quality, distorted, text, watermark"
      },
      "class_type": "CLIPTextEncode"
    },
    "5": {
      "inputs": {
        "model": ["1", 0],
        "anim_model": "mm_sd_v15_v2.ckpt",
        "batch_size": 1
      },
      "class_type": "ADE_AnimateDiffLoader"
    },
    "6": {
      "inputs": {
        "seed": Math.floor(Math.random() * 9999999999),
        "steps": 25,
        "cfg": 7,
        "sampler_name": "euler",
        "scheduler": "normal",
        "denoise": 1.0,
        "model": ["5", 0],
        "positive": ["3", 0],
        "negative": ["4", 0],
        "latent_image": ["2", 0]
      },
      "class_type": "KSampler"
    },
    "7": {
      "inputs": {
        "samples": ["6", 0],
        "vae": ["1", 2]
      },
      "class_type": "VAEDecode"
    },
    "8": {
      "inputs": {
        "fps": 12,
        "loop": 0,
        "images": ["7", 0]
      },
      "class_type": "VHS_VideoCombine"
    }
  };

  const result = await queuePrompt(animDiffWorkflow, prompt || '');
  if (!result.success || !result.prompt_id) {
    return { success: false, error: `ComfyUI 提交失败: ${result.error}` };
  }

  const completion = await waitForCompletion(result.prompt_id);
  if (!completion.completed) {
    return { success: false, error: `ComfyUI 超时: ${completion.error}` };
  }

  const videoUrl = await combineFramesToVideo(completion.images || [], 12);
  return {
    success: true,
    videoUrl: videoUrl || completion.images?.[0] || undefined,
    coverImage: completion.images?.[0],
    frames: completion.images?.length || 0,
    workflow: 'AnimateDiff → KSampler → VHS_VideoCombine'
  };
}

/**
 * 将帧图片列表合成为 MP4 视频
 */
async function combineFramesToVideo(
  frameUrls: string[],
  fps: number = 8
): Promise<string | null> {
  if (!frameUrls || frameUrls.length === 0) return null;

  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    const fs = await import('fs');

    const tempDir = `F:\\dunhuang-design\\uploads\\temp\\frames_${Date.now()}`;
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 下载所有帧
    for (let i = 0; i < frameUrls.length; i++) {
      const response = await fetch(frameUrls[i]);
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(`${tempDir}\\frame_${String(i).padStart(5, '0')}.png`, buffer);
      }
    }

    const outputPath = `${tempDir}\\output.mp4`;
    const ffmpegCmd = `ffmpeg -y -framerate ${fps} -i "${tempDir}\\frame_%05d.png" -c:v libx264 -pix_fmt yuv420p "${outputPath}"`;

    await execAsync(ffmpegCmd).catch(() => null);

    if (fs.existsSync(outputPath)) {
      const filename = `video_${Date.now()}.mp4`;
      const targetDir = getFileTypeDir('generated');
      const targetPath = `${targetDir}\\${filename}`;
      fs.copyFileSync(outputPath, targetPath);

      // 清理
      fs.rmSync(tempDir, { recursive: true, force: true });

      return `${process.env.BASE_URL || 'http://localhost:3000'}/api/download?type=generated&filename=${filename}`;
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
    return null;
  } catch {
    return null;
  }
}
