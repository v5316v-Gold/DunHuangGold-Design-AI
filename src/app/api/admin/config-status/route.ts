import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/validators';
import { getCurrentUser } from '@/lib/auth';

import { getApiConfig } from '@/lib/api-config-service';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

/**
 * 获取实际使用的配置状态
 * 用于检查配置是否生效
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');

    if (!configId) {
      return NextResponse.json(
        {  error: '请提供配置ID' },
        { status: 400 }
      );
    }

    const config = await getApiConfig(configId);

    if (!config) {
      return NextResponse.json({
        requestId: reqId(), success: false,
        status: 'not_configured',
        message: '未找到配置',
        configId,
        suggestion: '请在后台管理中配置此API，或者检查环境变量',
      });
    }

    return NextResponse.json({
      requestId: reqId(), success: true,
      status: config.enabled ? 'enabled' : 'disabled',
      message: config.enabled ? '配置已启用' : '配置未启用',
      config: {
        id: config.id,
        name: config.name,
        provider: config.provider,
        model: config.model,
        enabled: config.enabled,
        hasApiKey: !!config.apiKey,
        timeout: config.timeout,
      },
    });
  } catch (error) {
    console.error('[config-status] 错误:', error);
    return NextResponse.json(
      {  error: sanitizeError(error, '获取配置状态失败').message },
      { status: 500 }
    );
  }
}
