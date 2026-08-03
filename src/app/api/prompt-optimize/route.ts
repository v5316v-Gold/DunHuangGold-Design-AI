/**
 * 提示词优化 API
 * 使用助手设置中配置的API和规则
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/db';
import { promptRules, appSettings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createLogger } from '@/lib/error-handler';
import { unauthorized, internalError } from '@/lib/api-response';

const logger = createLogger('prompt-optimize');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 获取助手设置
async function getAssistantSettings() {
  if (!db) {
    logger.error('[prompt-optimize] 数据库未连接');
    return { selectedServices: {}, featureSwitches: {} };
  }
  
  try {
    const settings = await db.select().from(appSettings).where(eq(appSettings.id, 'default')).limit(1);
    if (settings.length > 0) {
      return {
        selectedServices: settings[0].selectedServices ? JSON.parse(settings[0].selectedServices as string) : {},
        featureSwitches: settings[0].featureSwitches ? JSON.parse(settings[0].featureSwitches as string) : {},
      };
    }
  } catch {
    logger.error('[prompt-optimize] 获取助手设置失败:');
  }
  return { selectedServices: {}, featureSwitches: {} };
}

// 获取启用的规则
async function getEnabledRules(category: string) {
  if (!db) {
    logger.error('[prompt-optimize] 数据库未连接');
    return [];
  }
  
  try {
    const rules = await db
      .select()
      .from(promptRules)
      .where(and(eq(promptRules.category, category), eq(promptRules.enabled, true)))
      .orderBy(promptRules.sortOrder);
    return rules;
  } catch {
    logger.error('[prompt-optimize] 获取规则失败:');
    return [];
  }
}

// 获取单个API配置
async function getApiConfig(provider: string) {
  if (!db) {
    logger.error('[prompt-optimize] 数据库未连接');
    return null;
  }
  
  try {
    const { apiConfigs } = await import('@/db/schema');
    const configs = await db.select().from(apiConfigs).where(eq(apiConfigs.id, provider)).limit(1);
    if (configs.length > 0 && configs[0].enabled) {
      return configs[0];
    }
  } catch {
    logger.error('[prompt-optimize] 获取API配置失败:');
  }
  return null;
}

// 获取第一个已启用的API配置（用于优化助手）
async function getFirstEnabledApiConfig() {
  if (!db) {
    logger.error('[prompt-optimize] 数据库未连接');
    return null;
  }
  
  try {
    const { apiConfigs } = await import('@/db/schema');
    // 获取所有已启用的配置，优先选择有 optimizeModel 的
    const configs = await db
      .select()
      .from(apiConfigs)
      .where(eq(apiConfigs.enabled, true));
    
    if (configs.length === 0) return null;
    
    // 优先选择 zhipu 提供商（有 optimizeModel 且有 apiKey）
    const zhipuConfig = configs.find(c => 
      c.provider === 'zhipu' && c.optimizeModel && c.apiKey
    );
    if (zhipuConfig) {
      logger.info('[prompt-optimize] 选择zhipu配置', { id: zhipuConfig.id });
      return zhipuConfig;
    }
    
    // 其次选择有 optimizeModel 且有 apiKey 的配置
    const withOptimizeModel = configs.find(c => c.optimizeModel && c.apiKey && c.provider !== 'xflow');
    if (withOptimizeModel) {
      logger.info('[prompt-optimize] 选择有optimizeModel的配置', { id: withOptimizeModel.id });
      return withOptimizeModel;
    }
    
    // 再次选择有 apiKey 的非 xflow 配置
    const withApiKey = configs.find(c => c.apiKey && c.provider !== 'xflow');
    if (withApiKey) {
      logger.info('[prompt-optimize] 选择有apiKey的配置', { id: withApiKey.id });
      return withApiKey;
    }
    
    // 最后才选择 xflow 配置（即使 apiKey 可能无效）
    const xflowConfig = configs.find(c => c.provider === 'xflow' && c.optimizeModel);
    if (xflowConfig) {
      logger.info('[prompt-optimize] 选择xflow配置（最后兜底）', { id: xflowConfig.id });
      return xflowConfig;
    }
    
    logger.info('[prompt-optimize] 没有找到有效的API配置');
    return null;
  } catch {
    logger.error('[prompt-optimize] 获取已启用API配置失败:');
  }
  return null;
}

// 调用LLM
async function callLLM(prompt: string, systemPrompt: string, apiConfig: any) {
  if (!apiConfig || !apiConfig.apiKey) {
    throw new Error('AI服务未配置，请先在助手设置中配置API');
  }

  const apiKey = apiConfig.apiKey;
  const baseUrl = apiConfig.url || 'https://open.bigmodel.cn/api/paas/v4';
  // 优先使用 optimizeModel（优化专用模型），其次是 model，最后是默认值
  const model = apiConfig.optimizeModel || apiConfig.model || 'glm-4-flash';

  // 构建消息
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  // 根据不同provider调用
  if (apiConfig.provider === 'minimax') {
    // MiniMax 专用端点
    const response = await fetch(`${baseUrl}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[prompt-optimize] MiniMax API错误:', errorText);
      if (response.status === 401 || response.status === 403) {
        throw new Error(`API密钥无效或已过期（${apiConfig.provider}），请检查助手设置中的API配置`);
      }
      throw new Error(`AI服务调用失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    
    if (data.base_resp?.status_code !== 0) {
      throw new Error(`AI服务错误: ${data.base_resp?.status_msg || '未知错误'}`);
    }
    
    throw new Error('AI服务响应格式错误');
  } else if (apiConfig.provider === 'zhipu' || apiConfig.provider === 'qwen' || !apiConfig.provider) {
    // 智谱/通义千问 (OpenAI兼容格式)
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[prompt-optimize] API错误:', errorText);
      if (response.status === 401 || response.status === 403) {
        throw new Error(`API密钥无效或已过期（${apiConfig.provider}），请检查助手设置中的API配置`);
      }
      throw new Error(`AI服务调用失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    
    throw new Error('AI服务响应格式错误');
  } else if (apiConfig.provider === 'xflow') {
    // xFlow API (OpenAI兼容格式)
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[prompt-optimize] xFlow API错误:', errorText);
      if (response.status === 401 || response.status === 403) {
        throw new Error(`API密钥无效或已过期（${apiConfig.provider}），请检查助手设置中的API配置`);
      }
      throw new Error(`AI服务调用失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    
    throw new Error('AI服务响应格式错误');
  } else if (apiConfig.provider === 'ollama') {
    // Ollama API
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[prompt-optimize] Ollama API错误:', errorText);
      if (response.status === 401 || response.status === 403) {
        throw new Error(`API密钥无效或已过期（${apiConfig.provider}），请检查助手设置中的API配置`);
      }
      throw new Error(`AI服务调用失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.message?.content) {
      return data.message.content;
    }
    
    throw new Error('AI服务响应格式错误');
  }

  throw new Error('不支持的API提供商');
}

/**
 * 获取所有可用的API配置（用于回退）
 */
async function getAllEnabledApiConfigs() {
  if (!db) return [];
  
  try {
    const { apiConfigs } = await import('@/db/schema');
    const configs = await db
      .select()
      .from(apiConfigs)
      .where(eq(apiConfigs.enabled, true));
    
    // 只返回有 apiKey 的配置
    return configs.filter(c => c.apiKey);
  } catch {
    logger.error('[prompt-optimize] 获取API配置列表失败:');
    return [];
  }
}

/**
 * 使用回退机制调用LLM
 * 尝试多个API配置，直到成功
 */
async function callLLMWithFallback(prompt: string, systemPrompt: string, preferredConfigId?: string) {
  const allConfigs = await getAllEnabledApiConfigs();
  
  if (allConfigs.length === 0) {
    throw new Error('AI服务未配置，请先在助手设置-助手API管理中添加并启用API配置');
  }
  
  // 如果有首选配置，优先使用
  let configsToTry = allConfigs;
  if (preferredConfigId) {
    const preferred = allConfigs.find(c => c.id === preferredConfigId);
    if (preferred) {
      configsToTry = [preferred, ...allConfigs.filter(c => c.id !== preferredConfigId)];
    }
  }
  
  const errors: string[] = [];
  
  for (const config of configsToTry) {
    try {
      logger.info('[prompt-optimize] 尝试API配置', { id: config.id, provider: config.provider });
      const result = await callLLM(prompt, systemPrompt, config);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      // 如果是401/403错误，记录并尝试下一个配置
      if (errorMsg.includes('API密钥无效') || errorMsg.includes('401') || errorMsg.includes('403')) {
        logger.warn(`[prompt-optimize] API配置 ${config.id} 密钥无效，尝试下一个`);
        errors.push(`${config.id}: ${errorMsg}`);
        continue;
      }
      // 其他错误直接抛出
      throw error;
    }
  }
  
  // 所有配置都失败了
  throw new Error(`所有API配置都失败: ${errors.join('; ')}`);
}

/**
 * POST - 优化提示词
 */
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    if (!db) {
      logger.error('[prompt-optimize] 数据库未连接');
      return NextResponse.json({ success: false, error: '数据库未连接' }, { status: 500 });
    }
    
    const { prompt, ruleId, category = 'optimize' } = await request.json();

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ success: false, error: '请输入提示词' }, { status: 400 });
    }

    // 获取助手设置
    const settings = await getAssistantSettings();
    
    // 获取要使用的API配置
    // 优先级1: appSettings.selectedServices.expand 指定的配置
    // 优先级2: 从助手API管理中找到第一个已启用的配置
    let apiConfig = null;
    const selectedService = settings.selectedServices?.expand;
    
    if (selectedService) {
      apiConfig = await getApiConfig(selectedService);
    }
    
    // 如果没有指定配置或指定的配置不可用/未启用，获取第一个已启用的配置
    if (!apiConfig) {
      apiConfig = await getFirstEnabledApiConfig();
    }
    
    if (!apiConfig) {
      return NextResponse.json({ 
        success: false, 
        error: `AI服务未配置，请先在助手设置-助手API管理中添加并启用API配置` 
      }, { status: 400 });
    }
    
    logger.info('[prompt-optimize] 使用API配置', { apiConfigId: apiConfig.id, provider: apiConfig.provider, model: apiConfig.model || apiConfig.optimizeModel });

    // 获取规则
    let rules: any[] = [];
    
    if (ruleId) {
      // 指定了特定规则
      try {
        const specificRule = await db
          .select()
          .from(promptRules)
          .where(eq(promptRules.id, ruleId))
          .limit(1);
        if (specificRule.length > 0) {
          rules = specificRule;
        }
      } catch (error) {
        logger.error('[prompt-optimize] 获取指定规则失败:');
      }
    } else {
      // 获取该分类下所有启用的规则
      rules = await getEnabledRules(category);
    }

    if (rules.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '未找到启用的规则，请先在规则管理器中添加并启用规则' 
      }, { status: 400 });
    }

    // 使用第一条启用的规则
    const rule = rules[0];

    // 调用LLM（使用回退机制）
    const optimized = await callLLMWithFallback(
      prompt.trim(), 
      rule.systemPrompt,
      apiConfig?.id
    );

    return NextResponse.json({
      success: true,
      data: {
        original: prompt.trim(),
        optimized: optimized.trim(),
        rule: rule.name,
        category: rule.category,
      },
    });

  } catch (err: unknown) {
    logger.error('[prompt-optimize] 优化失败:');
    return internalError(err, '优化失败');
  }
}

/**
 * GET - 获取规则列表
 */
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    if (!db) {
      logger.error('[prompt-optimize] 数据库未连接');
      return NextResponse.json({ success: false, error: '数据库未连接' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let rules: any[] = [];
    
    if (category) {
      rules = await getEnabledRules(category);
    } else {
      // 获取所有启用的规则
      const allRules = await db
        .select()
        .from(promptRules)
        .where(eq(promptRules.enabled, true))
        .orderBy(promptRules.sortOrder);
      rules = allRules;
    }

    // 按分类分组
    const categorized: Record<string, any[]> = {};
    for (const rule of rules) {
      if (!categorized[rule.category]) {
        categorized[rule.category] = [];
      }
      categorized[rule.category].push({
        id: rule.id,
        name: rule.name,
        category: rule.category,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        categories: categorized,
        rules: rules.map(r => ({
          id: r.id,
          name: r.name,
          category: r.category,
        })),
      },
    });

  } catch (err: unknown) {
    logger.error('[prompt-optimize] 获取规则列表失败:');
    return internalError(err, '获取规则列表失败');
  }
}
