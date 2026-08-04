/**
 * 本地大模型配置路由
 * GET: 获取本地大模型配置
 * POST: 更新本地大模型配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { unauthorized } from '@/lib/api-response';
import { LocalLLMConfig, getDefaultLocalLLMConfig } from '@/config/api-settings';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { createLogger } from '@/lib/error-handler';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}
export const dynamic = 'force-dynamic';

const logger = createLogger('settings-llm');

const LLM_CONFIG_KEY = 'llm_config';

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    if (!db) {
      return NextResponse.json({
        requestId: reqId(), success: false,
        error: '数据库未连接',
      }, { status: 500 });
    }
    
    // 从数据库获取配置
    const result = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, LLM_CONFIG_KEY))
      .limit(1);
    
    let llmConfig: Partial<LocalLLMConfig> = {
      id: 'ai-chat',
      ...getDefaultLocalLLMConfig(),
    };
    
    // 如果数据库有配置，则使用数据库的配置
    if (result && result.length > 0 && result[0].value) {
      llmConfig = {
        ...getDefaultLocalLLMConfig(),
        ...(result[0].value as Partial<LocalLLMConfig>),
        id: 'ai-chat',
      };
    }
    
    return NextResponse.json({
      requestId: reqId(), success: true,
      data: llmConfig,
    });
  } catch (err: unknown) {
    logger.error('获取LLM配置失败:');
    return NextResponse.json({
      requestId: reqId(), success: false,
      error: (err instanceof Error ? err.message : String(err)),
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (!authUser) return unauthorized();

  try {
    if (!db) {
      return NextResponse.json({
        requestId: reqId(), success: false,
        error: '数据库未连接',
      }, { status: 500 });
    }
    
    const body = await request.json();
    const { config } = body;
    
    if (!config) {
      return NextResponse.json({
        requestId: reqId(), success: false,
        error: '缺少 config 参数',
      }, { status: 400 });
    }
    
    // 合并配置
    const mergedConfig: Partial<LocalLLMConfig> = {
      ...getDefaultLocalLLMConfig(),
      ...config,
      id: 'ai-chat',
    };
    
    // 获取当前数据库中的配置
    const result = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, LLM_CONFIG_KEY))
      .limit(1);
    
    if (result && result.length > 0) {
      // 更新现有记录
      await db
        .update(schema.systemSettings)
        .set({ 
          value: mergedConfig as any,
          updatedAt: new Date(),
        })
        .where(eq(schema.systemSettings.key, LLM_CONFIG_KEY));
    } else {
      // 创建新记录
      await db.insert(schema.systemSettings).values({
        key: LLM_CONFIG_KEY,
        value: mergedConfig as any,
        description: '本地大模型配置',
      });
    }
    
    return NextResponse.json({
      requestId: reqId(), success: true,
      data: mergedConfig,
    });
  } catch (err: unknown) {
    logger.error('保存LLM配置失败:');
    return NextResponse.json({
      requestId: reqId(), success: false,
      error: (err instanceof Error ? err.message : String(err)),
    }, { status: 500 });
  }
}

// 测试大模型连接
export async function PUT(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (!authUser) return unauthorized();

  try {
    const body = await request.json();
    const { action, config: testConfig } = body;
    
    if (action !== 'test') {
      return NextResponse.json({
        requestId: reqId(), success: false,
        error: '未知操作',
      }, { status: 400 });
    }
    
    // 从数据库获取当前配置
    let currentConfig: Partial<LocalLLMConfig> = {
      id: 'ai-chat',
      ...getDefaultLocalLLMConfig(),
    };
    
    if (db) {
      const result = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, LLM_CONFIG_KEY))
        .limit(1);
      
      if (result && result.length > 0 && result[0].value) {
        currentConfig = {
          ...getDefaultLocalLLMConfig(),
          ...(result[0].value as Partial<LocalLLMConfig>),
          id: 'ai-chat',
        };
      }
    }
    
    // 使用传入的配置或当前配置测试
    const configToTest = {
      ...currentConfig,
      ...testConfig,
    };
    
    // 调用Ollama API测试
    const baseUrl = configToTest.baseUrl || 'http://127.0.0.1:11434';
    
    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(configToTest.timeout || 10000),
      });
      
      if (response.ok) {
        const models = await response.json();
        return NextResponse.json({
          requestId: reqId(), success: true,
          data: {
            connected: true,
            models: models.models || [],
          },
        });
      } else {
        return NextResponse.json({
          requestId: reqId(), success: false,
          error: `连接失败: ${response.status}`,
        });
      }
    } catch (err: unknown) {
      return NextResponse.json({
        requestId: reqId(), success: false,
        error: `无法连接到 ${baseUrl}: ${(err instanceof Error ? err.message : String(err))}`,
      });
    }
  } catch (err: unknown) {
    logger.error('测试LLM连接失败:');
    return NextResponse.json({
      requestId: reqId(), success: false,
      error: (err instanceof Error ? err.message : String(err)),
    }, { status: 500 });
  }
}
