/**
 * AI 助手配置读取逻辑
 * 从数据库或环境变量获取 AI 助手配置
 */
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// AI助手配置键名
const AI_ASSISTANT_CONFIG_KEY = 'ai-assistant-config';

// AI助手配置类型
export interface AIAssistantConfig {
  apiKey: string;
  provider: 'zhipu' | 'doubao' | 'openai' | 'qwen' | 'kimi' | 'minimax' | 'custom' | 'openclaw';
  model: string;
  optimizeModel?: string;
}

// 从环境变量获取配置作为后备
function getEnvConfig(): AIAssistantConfig {
  if (process.env.ZHIPU_API_KEY) {
    return {
      apiKey: process.env.ZHIPU_API_KEY,
      provider: 'zhipu',
      model: 'glm-4-7-251222',
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      provider: 'openai',
      model: 'gpt-4o-mini',
    };
  }
  if (process.env.KIMI_API_KEY) {
    return {
      apiKey: process.env.KIMI_API_KEY,
      provider: 'kimi',
      model: 'moonshot-v1-8k',
    };
  }
  return {
    apiKey: '',
    provider: 'zhipu',
    model: 'glm-4-7-251222',
  };
}

/**
 * 获取 AI 助手配置
 * 优先级：数据库配置 > 环境变量
 */
export async function getAIAssistantConfig(): Promise<AIAssistantConfig> {
  // 优先从数据库获取
  if (db) {
    try {
      const result = await db
        .select({ value: systemSettings.value })
        .from(systemSettings)
        .where(eq(systemSettings.key, AI_ASSISTANT_CONFIG_KEY))
        .limit(1);

      if (result.length > 0 && result[0].value) {
        const config = JSON.parse(result[0].value as string);
        if (config && config.apiKey) {
          return {
            apiKey: config.apiKey,
            provider: config.provider || 'zhipu',
            model: config.model || 'glm-4-flash',
            optimizeModel: config.optimizeModel,
          };
        }
      }
    } catch (error) {
      console.warn('[AIAssistantConfig] 数据库读取失败，使用环境变量:', error);
    }
  }

  // 后备：环境变量
  return getEnvConfig();
}
