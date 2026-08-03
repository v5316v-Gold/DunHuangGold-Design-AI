import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { apiConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';
export const dynamic = 'force-dynamic';

// API配置项类型
interface ApiConfigItem {
  id: string;
  name: string;
  url: string | null;
  method: string;
  enabled: boolean;
  timeout: number;
  headers: Record<string, string>;
  paramMapping: Record<string, string>;
  responseMapping: Record<string, unknown>;
  fallback: Record<string, unknown>;
  description?: string;
  lastTested?: Date;
  testResult?: unknown;
}

// API配置映射类型
type ApiConfigMap = Record<string, ApiConfigItem>;

/**
 * 获取所有 API 配置（从数据库）
 * GET /api/admin/api-config-db
 */
/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到 /api/admin/settings
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);

    // 权限检查（需要管理员）
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
    }

    // 开发模式返回内存配置
    if (!db) {
      const { coreApiConfigs } = await import('@/lib/api-config');
      return NextResponse.json({
        success: true,
        data: coreApiConfigs,
        mode: 'memory',
      });
    }

    // 从数据库获取配置
    const configs = await db.select().from(apiConfigs);

    // 转换为对象格式
    const configsMap = configs.reduce((acc: ApiConfigMap, config) => {
      acc[config.id] = {
        id: config.id,
        name: config.name,
        url: config.url,
        method: config.method,
        enabled: config.enabled,
        timeout: config.timeout,
        headers: config.headers as Record<string, string>,
        paramMapping: config.paramMapping as Record<string, string>,
        responseMapping: config.responseMapping as Record<string, unknown>,
        fallback: config.fallback as Record<string, unknown>,
        description: config.description || undefined,
        lastTested: config.lastTested || undefined,
        testResult: config.testResult || undefined,
      };
      return acc;
    }, {} as ApiConfigMap);

    return NextResponse.json({
      success: true,
      data: configsMap,
      mode: 'database',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '获取配置失败';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * 更新 API 配置（保存到数据库）
 * PUT /api/admin/api-config-db
 */
export async function PUT(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
    }

    if (!db) {
      return NextResponse.json({
        success: true,
        message: '配置已更新（内存模式）',
      });
    }

    const body = await request.json();
    const { id, config } = body;

    if (!id || !config) {
      return NextResponse.json({ success: false, error: '缺少参数' }, { status: 400 });
    }

    // 更新数据库
    await db
      .update(apiConfigs)
      .set({
        name: config.name,
        url: config.url,
        method: config.method,
        enabled: config.enabled,
        timeout: config.timeout,
        headers: config.headers || {},
        paramMapping: config.paramMapping || {},
        responseMapping: config.responseMapping || {},
        fallback: config.fallback || {},
        description: config.description,
        updatedAt: new Date(),
      })
      .where(eq(apiConfigs.id, id));

    return NextResponse.json({
      success: true,
      message: '配置已保存到数据库',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '保存配置失败';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
