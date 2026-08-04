/**
 * 云端API配置路由
 * GET: 获取所有连接和功能配置
 * POST: 保存连接 或 保存功能配置
 *   - { action: 'saveConnection', connection } → 保存连接
 *   - { action: 'deleteConnection', connectionId } → 删除连接
 *   - { featureId, config } → 保存功能配置（兼容旧逻辑）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { unauthorized } from '@/lib/api-response';
import { FEATURE_DEFINITIONS, getFeature } from '@/config/features';
import { CloudApiConfig, CloudConnection, CloudProvider, getDefaultCloudConfig, getDefaultCloudConnection } from '@/config/api-settings';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}
export const dynamic = 'force-dynamic';

const CLOUD_CONFIGS_KEY = 'cloud_configs';
const CLOUD_CONNECTIONS_KEY = 'cloud_connections';

// GET: 获取连接列表 + 功能配置
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    if (!db) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未连接' }, { status: 500 });
    }

    // 获取连接列表
    const connResult = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, CLOUD_CONNECTIONS_KEY))
      .limit(1);

    let connections: Record<string, Partial<CloudConnection>> = {};
    if (connResult && connResult.length > 0 && connResult[0].value) {
      connections = connResult[0].value as Record<string, Partial<CloudConnection>>;
    }

    // 获取功能配置
    const configsResult = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, CLOUD_CONFIGS_KEY))
      .limit(1);

    let cloudConfigs: Record<string, Partial<CloudApiConfig>> = {};
    if (configsResult && configsResult.length > 0 && configsResult[0].value) {
      cloudConfigs = configsResult[0].value as Record<string, Partial<CloudApiConfig>>;
    }

    // 构建返回的功能配置（合并默认配置）
    const featureConfigs: Record<string, Partial<CloudApiConfig>> = {};
    for (const featureId of Object.keys(FEATURE_DEFINITIONS)) {
      featureConfigs[featureId] = {
        ...getDefaultCloudConfig(featureId),
        ...cloudConfigs[featureId],
        id: featureId,
      };
    }

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: {
        connections,
        featureConfigs,
      },
    });
  } catch (err: unknown) {
    // console.error('获取云端配置失败:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

// POST: 保存连接 或 保存功能配置
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    if (!db) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未连接' }, { status: 500 });
    }

    const body = await request.json();

    // ---- 保存连接 ----
    if (body.action === 'saveConnection') {
      const { connection } = body;
      if (!connection?.id) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 connection.id' }, { status: 400 });
      }

      const connResult = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, CLOUD_CONNECTIONS_KEY))
        .limit(1);

      let connections: Record<string, Partial<CloudConnection>> = {};
      if (connResult && connResult.length > 0 && connResult[0].value) {
        connections = connResult[0].value as Record<string, Partial<CloudConnection>>;
      }

      const providerInfo = getDefaultCloudConnection(connection.provider as CloudProvider);
      connections[connection.id] = {
        ...providerInfo,
        ...connections[connection.id],
        ...connection,
      };

      if (connResult.length > 0) {
        await db.update(schema.systemSettings)
          .set({ value: connections as any, updatedAt: new Date() })
          .where(eq(schema.systemSettings.key, CLOUD_CONNECTIONS_KEY));
      } else {
        await db.insert(schema.systemSettings).values({
          key: CLOUD_CONNECTIONS_KEY,
          value: connections as any,
          description: '云端AI服务连接配置',
        });
      }

      return NextResponse.json({ requestId: reqId(), success: true, data: connections[connection.id] });
    }

    // ---- 删除连接 ----
    if (body.action === 'deleteConnection') {
      const { connectionId } = body;
      if (!connectionId) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 connectionId' }, { status: 400 });
      }

      const connResult = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, CLOUD_CONNECTIONS_KEY))
        .limit(1);

      if (connResult && connResult.length > 0 && connResult[0].value) {
        const connections = connResult[0].value as Record<string, Partial<CloudConnection>>;
        delete connections[connectionId];
        await db.update(schema.systemSettings)
          .set({ value: connections as any, updatedAt: new Date() })
          .where(eq(schema.systemSettings.key, CLOUD_CONNECTIONS_KEY));
      }

      return NextResponse.json({ requestId: reqId(), success: true });
    }

    // ---- 保存功能配置（兼容旧逻辑）----
    const { featureId, config } = body;
    if (!featureId || !config) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 featureId 或 config 参数' }, { status: 400 });
    }

    const feature = getFeature(featureId);
    if (!feature) {
      return NextResponse.json({ requestId: reqId(), success: false, error: `功能不存在: ${featureId}` }, { status: 400 });
    }

    const configsResult = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, CLOUD_CONFIGS_KEY))
      .limit(1);

    let cloudConfigs: Record<string, Partial<CloudApiConfig>> = {};
    if (configsResult && configsResult.length > 0 && configsResult[0].value) {
      cloudConfigs = configsResult[0].value as Record<string, Partial<CloudApiConfig>>;
    }

    cloudConfigs[featureId] = {
      ...getDefaultCloudConfig(featureId),
      ...cloudConfigs[featureId],
      ...config,
      id: featureId,
    };

    if (configsResult.length > 0) {
      await db.update(schema.systemSettings)
        .set({ value: cloudConfigs as any, updatedAt: new Date() })
        .where(eq(schema.systemSettings.key, CLOUD_CONFIGS_KEY));
    } else {
      await db.insert(schema.systemSettings).values({
        key: CLOUD_CONFIGS_KEY,
        value: cloudConfigs as any,
        description: '云端AI服务配置',
      });
    }

    return NextResponse.json({ requestId: reqId(), success: true, data: cloudConfigs[featureId] });
  } catch (err: unknown) {
    // console.error('保存云端配置失败:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
