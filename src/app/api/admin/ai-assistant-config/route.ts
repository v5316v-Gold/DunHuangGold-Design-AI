/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到 /api/admin/settings
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAIAssistantConfig } from '@/lib/ai-assistant-config';
export type { AIAssistantConfig } from '@/lib/ai-assistant-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// AI助手配置键名
const AI_ASSISTANT_CONFIG_KEY = 'ai-assistant-config';

// 保存AI助手配置到数据库
async function saveAIAssistantConfigToDB(config: {
  apiKey?: string;
  provider?: string;
  model?: string;
  optimizeModel?: string;
}) {
  if (!db) {
    console.error('[AI助手配置] 数据库连接不可用');
    return false;
  }

  try {
    const existing = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, AI_ASSISTANT_CONFIG_KEY))
      .limit(1);

    const value = {
      apiKey: config.apiKey || '',
      provider: config.provider || 'zhipu',
      model: config.model || 'glm-4-7-251222',
      optimizeModel: config.optimizeModel || config.model || 'glm-4-flash',
    };

    if (existing.length > 0) {
      await db.delete(systemSettings).where(eq(systemSettings.key, AI_ASSISTANT_CONFIG_KEY));
      await db.insert(systemSettings).values({
        key: AI_ASSISTANT_CONFIG_KEY,
        value,
        description: '提示词小助手配置',
      });
    } else {
      await db.insert(systemSettings).values({
        key: AI_ASSISTANT_CONFIG_KEY,
        value,
        description: '提示词小助手配置',
      });
    }

    try {
      await db.execute(sql`
        INSERT INTO api_configs (id, name, api_key, provider, model, optimize_model, enabled)
        VALUES ('llm-chat', 'LLM Chat', ${config.apiKey || ''}, ${config.provider || 'minimax'}, ${config.model || 'MiniMax-M2.7-highspeed'}, ${config.optimizeModel || config.model || 'glm-4-flash'}, true)
        ON CONFLICT (id) DO UPDATE SET
          api_key = EXCLUDED.api_key,
          provider = EXCLUDED.provider,
          model = EXCLUDED.model,
          optimize_model = EXCLUDED.optimize_model,
          enabled = EXCLUDED.enabled
      `);
    } catch (error) {
      console.error('[AI助手配置] 更新 llm-chat 配置失败:', error);
    }

    return true;
  } catch (error) {
    console.error('[AI助手配置] 保存失败:', error);
    return false;
  }
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }
  const config = await getAIAssistantConfig();

  return NextResponse.json({
    success: true,
    data: {
      hasKey: !!config.apiKey,
      apiKey: config.apiKey,
      provider: config.provider,
      model: config.model,
      optimizeModel: config.optimizeModel,
      timestamp: Date.now(),
    },
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    const body = await request.json();
    const { apiKey, provider, model, optimizeModel } = body;

    const existingConfig = await getAIAssistantConfig();

    const updateData: {
      apiKey?: string;
      provider?: string;
      model?: string;
      optimizeModel?: string;
    } = {};

    if (apiKey && apiKey !== '******') {
      updateData.apiKey = apiKey;
    }
    if (provider) updateData.provider = provider;
    if (model) updateData.model = model;
    if (optimizeModel) updateData.optimizeModel = optimizeModel;

    const saved = await saveAIAssistantConfigToDB({
      apiKey: updateData.apiKey || existingConfig.apiKey,
      provider: updateData.provider || existingConfig.provider,
      model: updateData.model || existingConfig.model,
      optimizeModel: updateData.optimizeModel || existingConfig.optimizeModel || updateData.model,
    });

    if (!saved) {
      return NextResponse.json(
        { success: false, error: '保存配置失败，数据库不可用' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        hasKey: !!(updateData.apiKey || existingConfig.apiKey),
        apiKey: updateData.apiKey || existingConfig.apiKey,
        provider: updateData.provider || existingConfig.provider,
        model: updateData.model || existingConfig.model,
        optimizeModel: updateData.optimizeModel || existingConfig.optimizeModel || updateData.model,
      },
    });
  } catch (error) {
    console.error('保存AI助手配置失败:', error);
    const errorMessage = error instanceof Error ? error.message : '保存失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
