/**
 * ComfyUI 统一调用服务
 * 
 * 根据数据库配置，动态执行 ComfyUI 工作流
 * 支持：
 * - 节点映射：把前端参数注入到正确的节点
 * - 默认参数：工作流的预设参数
 * - 固定参数：敦煌风格前缀等固定内容
 * - 连接选择：从多个连接中选择在线的
 * - 自动回退：本地失败自动切换云端
 */

import { db } from '@/storage/database/db';
import { memoryDb } from '@/storage/database/memory-db';
import { comfyuiConfigs, comfyuiConnections } from '@/storage/database/shared/schema';
import { eq, and } from 'drizzle-orm';

/* eslint-disable @typescript-eslint/no-explicit-any */


// ==================== 类型定义 ====================

export interface ComfyUICallOptions {
  featureId: string;
  prompt?: string;
  negativePrompt?: string;
  inputImage?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  count?: number;
  model?: string;
  [key: string]: any;
}

export interface ComfyUICallResult {
  success: boolean;
  source: 'local' | 'cloud';
  images?: string[];
  error?: string;
  promptId?: string;
  workflowId?: string;
  executionTimeMs?: number;
  usedConnection?: {
    id: string;
    name: string;
    host: string;
  };
}

export interface WorkflowConfig {
  id: string;
  featureId: string;
  workflowJson: Record<string, any>;
  nodeMapping: {
    prompt?: string;
    negativePrompt?: string;
    inputImage?: string;
    width?: string;
    height?: string;
    model?: string;
    seed?: string;
    steps?: string;
    cfg?: string;
    sampler?: string;
    denoise?: string;
    outputImage?: string;
    [key: string]: string | undefined;
  };
  defaultParams: {
    width?: number;
    height?: number;
    steps?: number;
    cfg?: number;
    sampler?: string;
    model?: string;
    denoise?: number;
    batchSize?: number;
    [key: string]: any;
  };
  fixedParams: {
    promptPrefix?: string;
    promptSuffix?: string;
    negativePrompt?: string;
    [key: string]: any;
  };
  connectionId: string;
  enabled: boolean;
}

export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  authToken?: string;
  enabled: boolean;
  isDefault: boolean;
  priority: number;
  timeout: number;
}

// ==================== ComfyUI 调用 ====================

const COMFYUI_HOST = process.env.COMFYUI_HOST || '127.0.0.1';
const COMFYUI_PORT = process.env.COMFYUI_PORT || '8188';
const DEFAULT_TIMEOUT = 120000;

/**
 * 提交 Prompt 到 ComfyUI
 */
async function queuePrompt(host: string, workflow: Record<string, any>): Promise<{ success: boolean; promptId?: string; error?: string }> {
  try {
    const response = await fetch(`http://${host}/api/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
      // Phase 4：硬超时保护（ComfyUI 未运行时不挂起，8s 内快速失败触发 fallback）
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${error}` };
    }

    const data = await response.json();
    return { success: true, promptId: data.prompt_id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '提交失败' };
  }
}

/**
 * 获取执行历史
 */
async function getHistory(host: string, promptId: string): Promise<any> {
  try {
    const response = await fetch(`http://${host}/api/history/${promptId}`, {
      // Phase 4：硬超时保护（8s）
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * 获取输出图片
 */
async function getOutputImages(host: string, promptId: string): Promise<string[]> {
  const history = await getHistory(host, promptId);
  if (!history || !history[promptId]) return [];

  const outputs = history[promptId].outputs || {};
  const images: string[] = [];

  for (const nodeId of Object.keys(outputs)) {
    const nodeOutput = outputs[nodeId];
    
    if (nodeOutput.images) {
      for (const img of nodeOutput.images) {
        const filename = typeof img === 'string' ? img : img.filename;
        if (filename) {
          images.push(`/api/comfyui-image?filename=${encodeURIComponent(filename)}`);
        }
      }
    }
  }

  return images;
}

/**
 * 轮询等待执行完成
 */
async function waitForCompletion(
  host: string,
  promptId: string,
  maxWaitMs: number = 300000,
  intervalMs: number = 2000
): Promise<{ completed: boolean; images?: string[]; error?: string }> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const history = await getHistory(host, promptId);

    if (history && history[promptId]) {
      const status = history[promptId].status;

      if (status?.err) {
        return { completed: true, error: '执行失败: ' + (status.err || '未知错误') };
      }

      if (status?.completed) {
        const images = await getOutputImages(host, promptId);
        return { completed: true, images };
      }
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return { completed: false, error: '执行超时' };
}

/**
 * 注入参数到工作流节点
 */
function injectParamsToWorkflow(
  workflow: Record<string, any>,
  nodeMapping: WorkflowConfig['nodeMapping'],
  options: ComfyUICallOptions,
  defaultParams: WorkflowConfig['defaultParams'],
  fixedParams: WorkflowConfig['fixedParams']
): Record<string, any> {
  const modified = JSON.parse(JSON.stringify(workflow));

  // 构建完整的提示词
  let finalPrompt = options.prompt || '';
  if (fixedParams.promptPrefix) {
    finalPrompt = fixedParams.promptPrefix + finalPrompt;
  }
  if (fixedParams.promptSuffix) {
    finalPrompt = finalPrompt + fixedParams.promptSuffix;
  }

  // 构建完整的负向提示词
  let finalNegativePrompt = options.negativePrompt || '';
  if (fixedParams.negativePrompt) {
    finalNegativePrompt = finalNegativePrompt 
      ? `${finalNegativePrompt}, ${fixedParams.negativePrompt}`
      : fixedParams.negativePrompt;
  }

  // 遍历节点映射，注入参数
  for (const [paramName, nodeId] of Object.entries(nodeMapping)) {
    if (!nodeId || nodeId === '') continue;

    const node = modified[nodeId];
    if (!node || !node.inputs) continue;

    switch (paramName) {
      case 'prompt':
        node.inputs.positive = finalPrompt;
        break;
      case 'negativePrompt':
        node.inputs.negative_prompt = finalNegativePrompt;
        node.inputs.text = finalNegativePrompt;
        break;
      case 'inputImage':
        node.inputs.image = options.inputImage;
        break;
      case 'width':
        node.inputs.width = options.width || defaultParams.width || 512;
        break;
      case 'height':
        node.inputs.height = options.height || defaultParams.height || 512;
        break;
      case 'steps':
        node.inputs.steps = options.steps || defaultParams.steps || 20;
        break;
      case 'cfg':
        node.inputs.cfg = options.cfg || defaultParams.cfg || 7.0;
        break;
      case 'seed':
        node.inputs.seed = options.seed ?? Math.floor(Math.random() * 9999999999);
        break;
      case 'model':
        node.inputs.ckpt_name = options.model || defaultParams.model || '';
        break;
      case 'denoise':
        node.inputs.denoise = options.denoise || defaultParams.denoise || 1.0;
        break;
      case 'batchSize':
        node.inputs.batch_size = options.count || defaultParams.batchSize || 1;
        break;
      default:
        if (options[paramName] !== undefined) {
          node.inputs[paramName] = options[paramName];
        }
    }
  }

  return modified;
}

/**
 * 上传图片到 ComfyUI（base64 → /upload/image）
 * 返回上传后的文件名（LoadImage 节点 image 参数使用）
 */
async function uploadImageToComfyUI(
  host: string,
  imageData: string,
  authToken?: string
): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    // 提取 base64（支持 data:image/png;base64,xxx 或纯 base64）
    const m = imageData.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
    const b64 = m ? m[1] : imageData;
    const buffer = Buffer.from(b64, 'base64');

    // ComfyUI /upload/image 接口：multipart form-data, 字段名 image, 可加 overwrite=1
    const form = new FormData();
    const blob = new Blob([buffer]);
    form.append('image', blob, `input_${Date.now()}.png`);
    form.append('overwrite', 'true');

    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const response = await fetch(`http://${host}/upload/image`, {
      method: 'POST',
      body: form,
      headers,
      // Phase 4：上传超时保护（15s）
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `上传图片失败 HTTP ${response.status}: ${err}` };
    }

    const data = (await response.json()) as { name?: string };
    if (!data.name) {
      return { success: false, error: '上传图片响应缺少文件名' };
    }
    return { success: true, filename: data.name };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '上传图片失败',
    };
  }
}

// ==================== 配置获取 ====================

/**
 * 获取可用的 ComfyUI 连接 (在线的优先)
 */
export async function getAvailableConnection(connectionId?: string): Promise<ConnectionConfig | null> {
  // 无数据库时使用默认配置
  if (!db) {
    if (connectionId && connectionId !== 'default') {
      return null;
    }
    return {
      id: 'default',
      name: '本地 ComfyUI',
      host: COMFYUI_HOST,
      port: parseInt(COMFYUI_PORT),
      enabled: true,
      isDefault: true,
      priority: 0,
      timeout: DEFAULT_TIMEOUT,
    };
  }

  try {
    if (connectionId) {
      const conns = await db
        .select()
        .from(comfyuiConnections)
        .where(and(
          eq(comfyuiConnections.id, connectionId),
          eq(comfyuiConnections.enabled, true)
        ))
        .limit(1);

      if (conns.length > 0) {
        return {
          id: conns[0].id,
          name: conns[0].name,
          host: conns[0].host,
          port: conns[0].port || 8188,
          authToken: conns[0].authToken || undefined,
          enabled: conns[0].enabled || false,
          isDefault: conns[0].isDefault || false,
          priority: conns[0].priority || 0,
          timeout: conns[0].timeout || DEFAULT_TIMEOUT,
        };
      }
    }

    const conns = await db
      .select()
      .from(comfyuiConnections)
      .where(eq(comfyuiConnections.enabled, true))
      .orderBy(comfyuiConnections.priority);

    for (const conn of conns) {
      const isOnline = await checkConnectionOnline(conn.host, conn.port || 8188);
      if (isOnline) {
        return {
          id: conn.id,
          name: conn.name,
          host: conn.host,
          port: conn.port || 8188,
          authToken: conn.authToken || undefined,
          enabled: conn.enabled || false,
          isDefault: conn.isDefault || false,
          priority: conn.priority || 0,
          timeout: conn.timeout || DEFAULT_TIMEOUT,
        };
      }
    }

    if (conns.length > 0) {
      return {
        id: conns[0].id,
        name: conns[0].name,
        host: conns[0].host,
        port: conns[0].port || 8188,
        authToken: conns[0].authToken || undefined,
        enabled: conns[0].enabled || false,
        isDefault: conns[0].isDefault || false,
        priority: conns[0].priority || 0,
        timeout: conns[0].timeout || DEFAULT_TIMEOUT,
      };
    }

    return null;
  } catch (error) {
    console.error('[ComfyUI] 获取连接失败:', error);
    return null;
  }
}

/**
 * 检查连接是否在线
 */
async function checkConnectionOnline(host: string, port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://${host}:${port}/system_stats`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 获取功能的工作流配置
 */
export async function getWorkflowConfig(featureId: string): Promise<WorkflowConfig | null> {
  // 使用内存数据库
  if (!db) {
    try {
      const config = await memoryDb.configs.findFirst(featureId);
      if (!config) return null;
      return {
        id: config.id,
        featureId: config.featureId,
        workflowJson: config.workflowJson || {},
        nodeMapping: (config.nodeMapping || {}) as WorkflowConfig['nodeMapping'],
        defaultParams: config.defaultParams || {},
        fixedParams: config.fixedParams || {},
        connectionId: config.connectionId || '',
        enabled: config.enabled || false,
      };
    } catch (error) {
      console.error('[ComfyUI] 获取工作流配置失败:', error);
      return null;
    }
  }

  try {
    const configs = await db
      .select()
      .from(comfyuiConfigs)
      .where(and(
        eq(comfyuiConfigs.featureId, featureId),
        eq(comfyuiConfigs.enabled, true)
      ))
      .limit(1);

    if (configs.length === 0) {
      return null;
    }

    const config = configs[0];
    return {
      id: config.id,
      featureId: config.featureId,
      workflowJson: config.workflowJson || {},
      nodeMapping: (config.nodeMapping || {}) as WorkflowConfig['nodeMapping'],
      defaultParams: config.defaultParams || {},
      fixedParams: config.fixedParams || {},
      connectionId: config.connectionId || '',
      enabled: config.enabled || false,
    };
  } catch (error) {
    console.error('[ComfyUI] 获取工作流配置失败:', error);
    return null;
  }
}

// ==================== 主调用函数 ====================

/**
 * 执行 ComfyUI 工作流
 */
export async function callComfyUI(options: ComfyUICallOptions): Promise<ComfyUICallResult> {
  const startTime = Date.now();
  const { featureId } = options;

  // 1. 获取工作流配置
  const workflowConfig = await getWorkflowConfig(featureId);
  
  if (!workflowConfig) {
    return {
      success: false,
      source: 'local',
      error: `功能 ${featureId} 未配置 ComfyUI 工作流，请先在管理后台配置`,
    };
  }

  if (!workflowConfig.workflowJson || Object.keys(workflowConfig.workflowJson).length === 0) {
    return {
      success: false,
      source: 'local',
      error: `功能 ${featureId} 的工作流 JSON 为空，请配置工作流`,
    };
  }

  // 2. 获取可用连接
  const connection = await getAvailableConnection(workflowConfig.connectionId);
  
  if (!connection) {
    return {
      success: false,
      source: 'local',
      error: '没有可用的 ComfyUI 连接，请先添加并检测连接',
    };
  }

  const host = `${connection.host}:${connection.port}`;

  // 3. 检查连接是否在线
  const isOnline = await checkConnectionOnline(connection.host, connection.port);
  if (!isOnline) {
    return {
      success: false,
      source: 'local',
      error: `ComfyUI 连接 ${connection.name} (${host}) 不在线，请检查服务是否启动`,
      usedConnection: {
        id: connection.id,
        name: connection.name,
        host: host,
      },
    };
  }

  // 4. 注入参数到工作流
  //    若含 base64 图片，先上传到 ComfyUI 换取文件名（LoadImage 节点需要）
  let callOptions = { ...options };
  if (options.inputImage && options.inputImage.startsWith('data:')) {
    const upload = await uploadImageToComfyUI(host, options.inputImage, connection.authToken);
    if (!upload.success || !upload.filename) {
      return {
        success: false,
        source: 'local',
        error: upload.error || '上传图片失败',
        usedConnection: { id: connection.id, name: connection.name, host },
      };
    }
    callOptions = { ...callOptions, inputImage: upload.filename };
  }

  const workflow = injectParamsToWorkflow(
    workflowConfig.workflowJson,
    workflowConfig.nodeMapping,
    callOptions,
    workflowConfig.defaultParams,
    workflowConfig.fixedParams
  );

  // 5. 提交执行
  const submitResult = await queuePrompt(host, workflow);
  if (!submitResult.success || !submitResult.promptId) {
    return {
      success: false,
      source: 'local',
      error: submitResult.error || '提交工作流失败',
      usedConnection: {
        id: connection.id,
        name: connection.name,
        host: host,
      },
    };
  }

  // 6. 等待执行完成 —— 严格限制 timeout,避免 ComfyUI 异常时 fallback 链被
  //    5 分钟 polling 拖死 worker。默认 connection.timeout(已 120s),
  //    这里再额外夹一道 30s 上限,逼迫走 fallback / dead_letter。
  const waitBudgetMs = Math.min(connection.timeout || 120000, 30_000);
  const completion = await waitForCompletion(
    host,
    submitResult.promptId,
    waitBudgetMs
  );

  return {
    success: completion.completed,
    source: 'local',
    images: completion.images,
    error: completion.error,
    promptId: submitResult.promptId,
    workflowId: workflowConfig.id,
    executionTimeMs: Date.now() - startTime,
    usedConnection: {
      id: connection.id,
      name: connection.name,
      host: host,
    },
  };
}

/**
 * 检查 ComfyUI 健康状态
 */
export async function checkComfyUIHealth(connectionId?: string): Promise<{
  online: boolean;
  connection?: ConnectionConfig;
  version?: string;
  gpu?: string;
  error?: string;
}> {
  const connection = await getAvailableConnection(connectionId);
  
  if (!connection) {
    return { online: false, error: '没有配置 ComfyUI 连接' };
  }

  const host = `${connection.host}:${connection.port}`;

  try {
    const response = await fetch(`http://${host}/system_stats`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { online: false, error: `HTTP ${response.status}`, connection };
    }

    const stats = await response.json();
    return {
      online: true,
      connection,
      version: stats.system?.comfyui_version,
      gpu: stats.devices?.[0]?.name,
    };
  } catch (error) {
    return {
      online: false,
      error: error instanceof Error ? error.message : '连接失败',
      connection,
    };
  }
}
