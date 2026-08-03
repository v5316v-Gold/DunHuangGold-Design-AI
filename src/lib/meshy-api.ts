/**
 * Meshy API 服务
 * 提供3D建模、浮雕、立体化等功能的统一API调用
 *
 * API 文档: https://docs.meshy.ai/
 */

const MESHY_BASE = 'https://api.meshy.ai/openapi/v1';

export interface MeshyConfig {
  apiKey: string;
  mode: 'text-to-3d' | 'image-to-3d';
  aiModel?: 'meshy-5' | 'meshy-6' | 'latest';
  modelType?: 'standard' | 'lowpoly';
  shouldTexture?: boolean;
  shouldRemesh?: boolean;
  symmetryMode?: 'off' | 'auto' | 'on';
  poseMode?: 'a-pose' | 't-pose' | '';
  imageEnhancement?: boolean;
  removeLighting?: boolean;
  artisticStyle?: string;
}

export interface MeshyTaskResult {
  taskId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED';
  modelUrl?: string;
  modelUrls?: {
    glb?: string;
    fbx?: string;
    obj?: string;
    usdz?: string;
    stl?: string;
    mtl?: string;
    threeDmf?: string;
    depthMap?: string;
    normalMap?: string;
  };
  previewImage?: string;
  progress?: number;
  error?: string;
  depthMap?: string;
  normalMap?: string;
}

/**
 * 创建 Image to 3D 任务
 */
export async function createImageTo3DTask(
  imageUrl: string,
  config: MeshyConfig
): Promise<string> {
  const response = await fetch(`${MESHY_BASE}/image-to-3d`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: imageUrl,
      ai_model: config.aiModel || 'latest',
      model_type: config.modelType || 'standard',
      should_texture: config.shouldTexture ?? true,
      should_remesh: config.shouldRemesh ?? false,
      symmetry_mode: config.symmetryMode || 'auto',
      pose_mode: config.poseMode || '',
      image_enhancement: config.imageEnhancement ?? true,
      remove_lighting: config.removeLighting ?? true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Meshy image-to-3d 失败 (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const taskId = data.result || data.task_id;
  if (!taskId) throw new Error('Meshy 未返回 task_id');
  return taskId;
}

/**
 * 创建 Text to 3D 任务
 */
export async function createTextTo3DTask(
  prompt: string,
  config: MeshyConfig
): Promise<string> {
  const response = await fetch(`${MESHY_BASE}/text-to-3d`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      ai_model: config.aiModel || 'latest',
      should_texture: config.shouldTexture ?? true,
      should_remesh: config.shouldRemesh ?? false,
      symmetry_mode: config.symmetryMode || 'auto',
      pose_mode: config.poseMode || '',
      image_enhancement: config.imageEnhancement ?? true,
      remove_lighting: config.removeLighting ?? true,
      artistic_style: config.artisticStyle,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Meshy text-to-3d 失败 (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const taskId = data.result || data.task_id;
  if (!taskId) throw new Error('Meshy 未返回 task_id');
  return taskId;
}

/**
 * 查询任务状态（轮询）
 */
export async function getTaskStatus(
  taskId: string,
  apiKey: string,
  type: 'image-to-3d' | 'text-to-3d' = 'image-to-3d'
): Promise<MeshyTaskResult> {
  const endpoint = type === 'text-to-3d' ? 'text-to-3d' : 'image-to-3d';
  const response = await fetch(`${MESHY_BASE}/${endpoint}/${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`查询 Meshy 任务状态失败 (${response.status})`);
  }

  const data = await response.json();
  return {
    taskId: data.id || taskId,
    status: (data.status || 'PENDING').toUpperCase() as MeshyTaskResult['status'],
    modelUrls: data.model_urls,
    modelUrl: data.model_urls?.glb || data.model_url,
    previewImage: data.thumbnail_url || data.preview_image,
    progress: data.progress,
    error: data.error || data.message,
    depthMap: data.model_urls?.depthMap || data.depth_map,
    normalMap: data.model_urls?.normalMap || data.normal_map,
  };
}

/**
 * 轮询直到任务完成（最长5分钟）
 */
export async function pollTaskUntilComplete(
  taskId: string,
  apiKey: string,
  type: 'image-to-3d' | 'text-to-3d' = 'image-to-3d',
  maxAttempts = 300,
  delayMs = 1000
): Promise<MeshyTaskResult> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, delayMs));
    const result = await getTaskStatus(taskId, apiKey, type);
    if (result.status === 'SUCCEEDED') return result;
    if (result.status === 'FAILED') throw new Error(`Meshy 任务失败: ${result.error}`);
    // 继续等待
  }
  throw new Error('Meshy 任务轮询超时 (5分钟)');
}

/**
 * 完整的 Image to 3D 流程（阻塞轮询）
 */
export async function imageTo3D(
  image: string,
  config: MeshyConfig
): Promise<MeshyTaskResult> {
  const taskId = await createImageTo3DTask(image, config);
  return pollTaskUntilComplete(taskId, config.apiKey, 'image-to-3d');
}

/**
 * 完整的 Text to 3D 流程（阻塞轮询）
 */
export async function textTo3D(
  prompt: string,
  config: MeshyConfig
): Promise<MeshyTaskResult> {
  const taskId = await createTextTo3DTask(prompt, config);
  return pollTaskUntilComplete(taskId, config.apiKey, 'text-to-3d');
}

/**
 * Image to Relief 流程（使用 image-to-3d，meshy-6 浮雕风格）
 */
export async function imageToRelief(
  image: string,
  config: MeshyConfig
): Promise<MeshyTaskResult> {
  const taskId = await createImageTo3DTask(image, {
    ...config,
    aiModel: 'latest',
    modelType: 'standard',
    shouldTexture: true,
    shouldRemesh: true,
    imageEnhancement: true,
    removeLighting: true,
  });
  return pollTaskUntilComplete(taskId, config.apiKey, 'image-to-3d');
}

/**
 * 完整的深度图/立体图生成流程
 * 使用 image-to-3d 并从中提取深度信息
 */
export async function generateDepthMap(
  image: string,
  config: MeshyConfig
): Promise<MeshyTaskResult> {
  // Meshy image-to-3d 返回模型预览图和模型
  // 立体效果直接使用 image-to-3d 的结果
  const taskId = await createImageTo3DTask(image, {
    ...config,
    aiModel: 'latest',
    modelType: 'standard',
    shouldTexture: true,
    shouldRemesh: false, // 保留原始几何
    imageEnhancement: true,
    removeLighting: true,
  });
  return pollTaskUntilComplete(taskId, config.apiKey, 'image-to-3d');
}

/**
 * SSE 流式监听任务状态（给 API 路由使用）
 * 通过 ReadableStream 将 SSE 事件推送回客户端
 */
export function streamTaskStatus(
  taskId: string,
  apiKey: string,
  type: 'image-to-3d' | 'text-to-3d' = 'image-to-3d'
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  // 使用 SSE 流式端点
  const endpoint = type === 'text-to-3d' ? 'text-to-3d' : 'image-to-3d';

  const checked = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // 先立即发送 taskId，让前端知道任务已创建
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'started', taskId })}\n\n`));

      try {
        // 立即查询一次状态
        const initial = await getTaskStatus(taskId, apiKey, type);
        if (initial.status === 'SUCCEEDED' || initial.status === 'FAILED') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', ...initial })}\n\n`));
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', ...initial })}\n\n`));

        // 然后通过 SSE 流式监听
        const sseResponse = await fetch(`${MESHY_BASE}/${endpoint}/${taskId}/stream`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });

        if (!sseResponse.ok) {
          // 如果 SSE 不可用，回退到轮询
          await pollAndSend(controller, taskId, apiKey, type, encoder);
          return;
        }

        const reader = sseResponse.body?.getReader();
        if (!reader) {
          await pollAndSend(controller, taskId, apiKey, type, encoder);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]') continue;

            try {
              const update = JSON.parse(raw);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', ...update })}\n\n`));
              if (update.status === 'SUCCEEDED' || update.status === 'FAILED') {
                controller.close();
                return;
              }
            } catch {}
          }
        }

        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`));
        controller.close();
      }
    },
  });
}

async function pollAndSend(
  controller: ReadableStreamDefaultController<Uint8Array>,
  taskId: string,
  apiKey: string,
  type: 'image-to-3d' | 'text-to-3d',
  encoder: TextEncoder
) {
  for (let i = 0; i < 300; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const result = await getTaskStatus(taskId, apiKey, type);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', ...result })}\n\n`));
      if (result.status === 'SUCCEEDED' || result.status === 'FAILED') {
        controller.close();
        return;
      }
    } catch (err) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`));
      controller.close();
      return;
    }
  }
  controller.close();
}
