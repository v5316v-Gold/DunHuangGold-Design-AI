/**
 * 旧版 /api/admin/models —— AI 助手模型列表（供应商模型管理）
 *
 * 历史：早期版本在 /api/admin/models 提供"AI 助手自定义模型列表"功能
 * （从 OpenAI/智谱/通义/Kimi/MiniMax/豆包 拉取模型列表，存 systemSettings）。
 * 任务三引入模型中心（models 表 CRUD）后，为避免破坏历史调用方，
 * 旧逻辑整体迁移到本文件，由 route.ts 按 action/provider 参数分发。
 */

import { NextRequest, NextResponse } from 'next/server';

/* eslint-disable @typescript-eslint/no-explicit-any */

import { sanitizeError } from '@/lib/validators';
import { getCurrentUser } from '@/lib/auth';

import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { detectProviderByApiKey } from '@/lib/provider-detect';

// 模型列表键名
const MODELS_LIST_KEY = 'ai-assistant-models-list';

/**
 * 获取保存的模型列表
 */
async function getSavedModelsList() {
  if (!db) {
    return {};
  }

  try {
    const configs = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, MODELS_LIST_KEY))
      .limit(1);

    if (configs.length > 0) {
      return configs[0].value as Record<string, any>;
    }
  } catch (error) {
    console.error('[模型列表] 获取失败:', error);
  }

  return {};
}

/**
 * 保存模型列表
 */
async function saveModelsList(modelsList: Record<string, any>) {
  if (!db) return false;

  try {
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, MODELS_LIST_KEY))
      .limit(1);

    if (existing.length > 0) {
      await db
        .delete(systemSettings)
        .where(eq(systemSettings.key, MODELS_LIST_KEY));
    }

    await db.insert(systemSettings).values({
      key: MODELS_LIST_KEY,
      value: modelsList,
      description: 'AI助手自定义模型列表',
    });

    return true;
  } catch (error) {
    console.error('[模型列表] 保存失败:', error);
    return false;
  }
}

/**
 * 从供应商API获取模型列表
 */
async function fetchModelsFromProvider(provider: string, apiKey: string): Promise<any[]> {
  console.log('[模型列表] 从供应商获取模型:', provider);

  switch (provider) {
    case 'openai':
      return fetchOpenAIModels(apiKey);
    case 'zhipu':
      return fetchZhipuModels(apiKey);
    case 'qwen':
      return fetchQwenModels(apiKey);
    case 'kimi':
      return fetchKimiModels(apiKey);
    case 'minimax':
      return fetchMiniMaxModels(apiKey);
    case 'doubao':
      return fetchDoubaoModels(apiKey);
    default:
      return [];
  }
}

/**
 * 从OpenAI获取模型列表
 */
async function fetchOpenAIModels(apiKey: string): Promise<any[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`OpenAI API错误: ${response.status}`);
    }

    const data = await response.json();
    const chatModels = data.data
      .filter((model: any) => model.id.includes('gpt'))
      .map((model: any) => ({
        id: model.id,
        name: model.id,
        description: `OpenAI ${model.id}`,
        source: 'api',
        createdAt: new Date().toISOString(),
      }));

    return chatModels;
  } catch (error) {
    console.error('[OpenAI] 获取模型列表失败:', error);
    return [];
  }
}

/**
 * 从智谱AI获取模型列表
 */
async function fetchZhipuModels(apiKey: string): Promise<any[]> {
  const defaultModels = [
    { id: 'glm-4-plus', name: 'GLM-4-Plus', description: '最强能力模型', source: 'default' },
    { id: 'glm-4-7-251222', name: 'GLM-4-7B', description: '70亿参数，通用对话', source: 'default' },
    { id: 'glm-4-flashx', name: 'GLM-4-Flash', description: '超快响应，实时对话', source: 'default' },
    { id: 'glm-3-turbo', name: 'GLM-3-Turbo', description: '快速响应，轻量级', source: 'default' },
  ];

  try {
    // 智谱AI可能没有公开的模型列表API，返回默认列表
    console.log('[智谱AI] 返回默认模型列表');
    return defaultModels;
  } catch (error) {
    console.error('[智谱AI] 获取模型列表失败:', error);
    return defaultModels;
  }
}

/**
 * 从通义千问获取模型列表
 */
async function fetchQwenModels(apiKey: string): Promise<any[]> {
  const defaultModels = [
    { id: 'qwen-max', name: 'Qwen Max', description: '最强能力', source: 'default' },
    { id: 'qwen-plus', name: 'Qwen Plus', description: '平衡性能', source: 'default' },
    { id: 'qwen-turbo', name: 'Qwen Turbo', description: '超快响应', source: 'default' },
    { id: 'qwen-max-longcontext', name: 'Qwen Max Long', description: '长上下文', source: 'default' },
  ];

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.log('[通义千问] API调用失败，返回默认列表');
      return defaultModels;
    }

    const data = await response.json();
    const models = data.data?.map((model: any) => ({
      id: model.id,
      name: model.id,
      description: model.description || model.id,
      source: 'api',
      createdAt: new Date().toISOString(),
    })) || [];

    return models.length > 0 ? models : defaultModels;
  } catch (error) {
    console.error('[通义千问] 获取模型列表失败:', error);
    return defaultModels;
  }
}

/**
 * 从Kimi获取模型列表
 */
async function fetchKimiModels(apiKey: string): Promise<any[]> {
  const defaultModels = [
    { id: 'moonshot-v1', name: 'Moonshot V1', description: '通用对话', source: 'default' },
    { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K', description: '长文本处理', source: 'default' },
    { id: 'moonshot-v1-8k', name: 'Moonshot V1 8K', description: '快速响应', source: 'default' },
  ];

  try {
    // Kimi可能没有公开的模型列表API，返回默认列表
    console.log('[Kimi] 返回默认模型列表');
    return defaultModels;
  } catch (error) {
    console.error('[Kimi] 获取模型列表失败:', error);
    return defaultModels;
  }
}

/**
 * 从MiniMax获取模型列表
 */
async function fetchMiniMaxModels(apiKey: string): Promise<any[]> {
  const defaultModels = [
    { id: 'abab6.5', name: 'abab6.5', description: '通用对话', source: 'default' },
    { id: 'abab6.5s', name: 'abab6.5s', description: '超快响应', source: 'default' },
    { id: 'abab5.5-chat', name: 'abab5.5-chat', description: '轻量级对话', source: 'default' },
  ];

  try {
    console.log('[MiniMax] 返回默认模型列表');
    return defaultModels;
  } catch (error) {
    console.error('[MiniMax] 获取模型列表失败:', error);
    return defaultModels;
  }
}

/**
 * 从豆包获取模型列表
 */
async function fetchDoubaoModels(apiKey: string): Promise<any[]> {
  const defaultModels = [
    { id: 'doubao-pro', name: 'Doubao Pro', description: '专业版，高质量', source: 'default' },
    { id: 'doubao-lite', name: 'Doubao Lite', description: '轻量版，快速', source: 'default' },
    { id: 'doubao-pro-128k', name: 'Doubao Pro 128K', description: '长上下文版本', source: 'default' },
  ];

  try {
    console.log('[豆包] 返回默认模型列表');
    return defaultModels;
  } catch (error) {
    console.error('[豆包] 获取模型列表失败:', error);
    return defaultModels;
  }
}

/**
 * 旧版 GET —— 识别供应商 / 获取保存的模型列表 / 获取特定供应商模型列表
 */
export async function legacyGET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const apiKey = searchParams.get('apiKey');

    // 识别供应商
    if (action === 'detect-provider' && apiKey) {
      const provider = detectProviderByApiKey(apiKey);
      return NextResponse.json({
        success: true,
        data: { provider },
      });
    }

    // 获取保存的模型列表
    if (action === 'get-saved-models') {
      const modelsList = await getSavedModelsList();
      return NextResponse.json({
        success: true,
        data: modelsList,
      });
    }

    // 获取特定供应商的模型列表
    if (action === 'get-models' && searchParams.get('provider')) {
      const provider = searchParams.get('provider');
      const modelsList = await getSavedModelsList();
      const providerModels = modelsList[provider!] || [];

      return NextResponse.json({
        success: true,
        data: providerModels,
      });
    }

    return NextResponse.json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error('[模型列表API] 错误:', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error, '获取失败').message },
      { status: 500 }
    );
  }
}

/**
 * 旧版 POST —— 刷新 / 手动添加 / 删除供应商模型
 * body 必须带 action 字段
 */
export async function legacyPOST(body: Record<string, any>): Promise<NextResponse> {
  const { action, provider, apiKey, model } = body;

  // 从供应商API刷新模型列表
  if (action === 'fetch-models' && provider && apiKey) {
    console.log('[模型列表] 刷新模型列表:', provider);

    const models = await fetchModelsFromProvider(provider, apiKey);

    if (models.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未获取到模型列表',
      });
    }

    // 保存到数据库
    const modelsList = await getSavedModelsList();
    modelsList[provider] = models;
    await saveModelsList(modelsList);

    return NextResponse.json({
      success: true,
      data: models,
      message: `已获取 ${models.length} 个模型`,
    });
  }

  // 手动添加模型
  if (action === 'add-model' && provider && model) {
    const modelsList = await getSavedModelsList();

    if (!modelsList[provider]) {
      modelsList[provider] = [];
    }

    // 检查模型是否已存在
    const exists = modelsList[provider].some((m: any) => m.id === model.id);
    if (exists) {
      return NextResponse.json({
        success: false,
        error: '模型已存在',
      });
    }

    modelsList[provider].push({
      ...model,
      source: 'manual',
      createdAt: new Date().toISOString(),
    });

    await saveModelsList(modelsList);

    return NextResponse.json({
      success: true,
      data: model,
      message: '模型已添加',
    });
  }

  // 删除模型
  if (action === 'delete-model' && provider && model?.id) {
    const modelsList = await getSavedModelsList();

    if (modelsList[provider]) {
      modelsList[provider] = modelsList[provider].filter(
        (m: any) => m.id !== model.id
      );

      await saveModelsList(modelsList);

      return NextResponse.json({
        success: true,
        message: '模型已删除',
      });
    }

    return NextResponse.json({
      success: false,
      error: '模型不存在',
    });
  }

  return NextResponse.json({
    success: false,
    error: '未知操作',
  });
}

/**
 * 旧版 DELETE —— 清空指定供应商的模型列表
 */
export async function legacyDELETE(provider: string): Promise<NextResponse> {
  try {
    const modelsList = await getSavedModelsList();

    if (modelsList[provider]) {
      delete modelsList[provider];
      await saveModelsList(modelsList);

      return NextResponse.json({
        success: true,
        message: '模型列表已清空',
      });
    }

    return NextResponse.json({
      success: false,
      error: '模型列表不存在',
    });
  } catch (error) {
    console.error('[模型列表API] 错误:', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error, '删除失败').message },
      { status: 500 }
    );
  }
}
