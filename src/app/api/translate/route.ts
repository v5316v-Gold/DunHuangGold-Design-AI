/**
 * 翻译 API
 * 使用助手设置中配置的翻译服务
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { unauthorized, internalError } from '@/lib/api-response';
import { db } from '@/db';
import { promptRules, appSettings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('translate');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 翻译方向
type TranslateDir = 'zh-en' | 'en-zh';

// 获取助手设置
async function getAssistantSettings() {
  if (!db) {
    logger.error('[translate] 数据库未连接');
    return { selectedServices: {}, translateSettings: {} };
  }
  
  try {
    const settings = await db.select().from(appSettings).where(eq(appSettings.id, 'default')).limit(1);
    if (settings.length > 0) {
      return {
        selectedServices: settings[0].selectedServices ? JSON.parse(settings[0].selectedServices as string) : {},
        translateSettings: settings[0].translateSettings ? JSON.parse(settings[0].translateSettings as string) : {},
      };
    }
  } catch {
    logger.error('[translate] 获取助手设置失败:');
  }
  return { selectedServices: {}, translateSettings: {} };
}

// 获取翻译规则
async function getTranslateRule(dir: TranslateDir) {
  if (!db) {
    logger.error('[translate] 数据库未连接');
    return null;
  }
  
  const ruleId = dir === 'zh-en' ? 'translate-zh-en' : 'translate-en-zh';
  
  try {
    const result = await db
      .select()
      .from(promptRules)
      .where(and(eq(promptRules.id, ruleId), eq(promptRules.enabled, true)))
      .limit(1);
    
    if (result.length > 0) {
      return result[0].systemPrompt;
    }
  } catch {
    logger.error('[translate] 获取规则失败:');
  }
  
  return null;
}

// 获取API配置
async function getApiConfig(provider: string) {
  if (!db) {
    logger.error('[translate] 数据库未连接');
    return null;
  }
  
  try {
    const { apiConfigs } = await import('@/db/schema');
    const configs = await db.select().from(apiConfigs).where(eq(apiConfigs.id, provider)).limit(1);
    if (configs.length > 0 && configs[0].enabled) {
      return configs[0];
    }
  } catch {
    logger.error('[translate] 获取API配置失败:');
  }
  return null;
}

// 后处理翻译结果
function postProcessTranslation(text: string, settings: any): string {
  let result = text;

  // 保留换行符（默认开启）
  if (!settings.preserveNewline) {
    result = result.replace(/\n/g, ' ');
  }

  // 移除多余连续点号
  if (settings.removeRedundantDots) {
    result = result.replace(/\.{3,}/g, '...');
  }

  // 自动移除多余空格
  if (settings.removeExtraSpaces) {
    result = result.replace(/\s+/g, ' ').trim();
  }

  // 始终使用半角标点符号
  if (settings.halfwidthPunctuation) {
    result = result
      .replace(/，/g, ',')
      .replace(/。/g, '.')
      .replace(/？/g, '?')
      .replace(/！/g, '!')
      .replace(/：/g, ':')
      .replace(/；/g, ';')
      .replace(/"/g, '"')
      .replace(/"/g, '"')
      .replace(/'/g, "'")
      .replace(/'/g, "'");
  }

  return result.trim();
}

// 调用LLM
async function callLLM(prompt: string, systemPrompt: string, apiConfig: any) {
  const apiKey = apiConfig.apiKey;
  const baseUrl = apiConfig.url || 'https://open.bigmodel.cn/api/paas/v4';
  const model = apiConfig.model || 'glm-4-flash';
  const provider = apiConfig.provider;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  let response;
  
  if (provider === 'minimax') {
    // MiniMax 专用端点
    response = await fetch(`${baseUrl}/text/chatcompletion_v2`, {
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
  } else {
    // 通用OpenAI格式调用
    response = await fetch(`${baseUrl}/chat/completions`, {
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
  }

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('[translate] API错误:', errorText);
    throw new Error(`翻译服务调用失败: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }

  // Ollama格式
  if (data.message?.content) {
    return data.message.content;
  }
  
  throw new Error('翻译服务响应格式错误');
}

// 调用百度翻译
async function callBaiduTranslate(text: string, from: string, to: string, appId: string, secretKey: string) {
  const crypto = await import('crypto');
  
  const salt = Date.now().toString();
  const sign = crypto.createHash('md5')
    .update(appId + text + salt + secretKey)
    .digest('hex');
  
  const params = new URLSearchParams({
    q: text,
    from: from,
    to: to,
    appid: appId,
    salt: salt,
    sign: sign,
  });

  const response = await fetch('https://fanyi-api.baidu.com/api/trans/vip/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`百度翻译API错误: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.error_code) {
    throw new Error(`百度翻译错误: ${data.error_msg || data.error_code}`);
  }
  
  return data.trans_result.map((t: any) => t.dst).join('');
}

// 主翻译函数
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    if (!db) {
      logger.error('[translate] 数据库未连接');
      return NextResponse.json({ success: false, error: '数据库未连接' }, { status: 500 });
    }
    
    const { text, dir = 'zh-en' } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ success: false, error: '请输入要翻译的文本' }, { status: 400 });
    }

    const translateDir: TranslateDir = dir === 'en-zh' ? 'en-zh' : 'zh-en';
    const settings = await getAssistantSettings();
    
    // 获取翻译设置
    const translateSettings = settings.translateSettings || {};
    
    // 获取选择的翻译服务
    const selectedService = settings.selectedServices?.translate || 'llm-chat';
    
    // 翻译结果
    let translated = '';

    // 优先使用百度翻译
    const baiduConfig = await getApiConfig('baidu-translate');
    
    if (baiduConfig && baiduConfig.appId && baiduConfig.apiKey) {
      // 百度翻译
      const from = translateDir === 'zh-en' ? 'zh' : 'en';
      const to = translateDir === 'zh-en' ? 'en' : 'zh';
      
      translated = await callBaiduTranslate(
        text.trim(),
        from,
        to,
        baiduConfig.appId,
        baiduConfig.apiKey
      );
    } else {
      // LLM翻译
      let apiConfig = await getApiConfig(selectedService);
      
      // Fallback到llm-chat
      if (!apiConfig) {
        apiConfig = await getApiConfig('llm-chat');
      }
      
      if (!apiConfig || !apiConfig.apiKey) {
        return NextResponse.json({ 
          success: false,
          error: `翻译服务未配置，请先在助手设置中配置API` 
        }, { status: 400 });
      }

      // 获取翻译规则
      const rule = await getTranslateRule(translateDir);
      
      const systemPrompt = rule || (
        translateDir === 'zh-en' 
          ? 'Translate the following Chinese text to English. Output only the translation.'
          : 'Translate the following English text to Chinese. Output only the translation.'
      );

      translated = await callLLM(text.trim(), systemPrompt, apiConfig);
    }

    // 后处理
    translated = postProcessTranslation(translated, translateSettings);

    return NextResponse.json({
      success: true,
      data: {
        original: text,
        translated,
        dir: translateDir,
      },
    });

  } catch (err: unknown) {
    logger.error('[translate] 翻译失败:');
    return internalError(err, '翻译失败');
  }
}
