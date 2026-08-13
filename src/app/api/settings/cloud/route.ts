/**
 * 云端API配置路由
 * GET: 获取所有连接和功能配置
 * POST: 保存连接 或 保存功能配置
 *   - { action: 'saveConnection', connection }
 *   - { action: 'deleteConnection', connectionId }
 *   - { featureId, config }
 *
 * Phase 5.1: 迁移到 SettingsRepository（消除 5 处直调 db）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { unauthorized } from '@/lib/api-response';
import { FEATURE_DEFINITIONS } from '@/config/features';
import { CloudApiConfig, CloudConnection, getDefaultCloudConfig } from '@/config/api-settings';
import { randomUUID } from 'crypto';
import { settingsRepository } from '@/db/repositories';

function reqId(): string {
  return `req_${randomUUID()}`;
}
export const dynamic = 'force-dynamic';

const CLOUD_CONFIGS_KEY = 'cloud_configs';
const CLOUD_CONNECTIONS_KEY = 'cloud_connections';

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    const connections = (await settingsRepository.findJson<Record<string, Partial<CloudConnection>>>(CLOUD_CONNECTIONS_KEY)) || {};
    const cloudConfigs = (await settingsRepository.findJson<Record<string, Partial<CloudApiConfig>>>(CLOUD_CONFIGS_KEY)) || {};

    const featureConfigs: Record<string, Partial<CloudApiConfig>> = {};
    for (const featureId of Object.keys(FEATURE_DEFINITIONS)) {
      featureConfigs[featureId] = {
        ...getDefaultCloudConfig(featureId),
        ...cloudConfigs[featureId],
        id: featureId,
      };
    }

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { connections, featureConfigs },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { requestId: reqId(), success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();

    if (body.action === 'saveConnection') {
      const { connection } = body;
      if (!connection?.id) {
        return NextResponse.json(
          { requestId: reqId(), success: false, error: '缺少 connection.id' },
          { status: 400 }
        );
      }

      const connections = (await settingsRepository.findJson<Record<string, Partial<CloudConnection>>>(CLOUD_CONNECTIONS_KEY)) || {};
      connections[connection.id] = connection;

      await settingsRepository.upsert(CLOUD_CONNECTIONS_KEY, connections, '云端AI服务连接配置');

      return NextResponse.json({ requestId: reqId(), success: true, data: connections[connection.id] });
    }

    if (body.action === 'deleteConnection') {
      const { connectionId } = body;
      if (!connectionId) {
        return NextResponse.json(
          { requestId: reqId(), success: false, error: '缺少 connectionId' },
          { status: 400 }
        );
      }

      const connections = (await settingsRepository.findJson<Record<string, Partial<CloudConnection>>>(CLOUD_CONNECTIONS_KEY)) || {};
      delete connections[connectionId];

      await settingsRepository.upsert(CLOUD_CONNECTIONS_KEY, connections, '云端AI服务连接配置');

      return NextResponse.json({ requestId: reqId(), success: true });
    }

    // ---- 保存功能配置（兼容旧逻辑）----
    const { featureId, config } = body;
    if (!featureId || !config) {
      return NextResponse.json(
        { requestId: reqId(), success: false, error: '缺少 featureId 或 config 参数' },
        { status: 400 }
      );
    }

    const cloudConfigs = (await settingsRepository.findJson<Record<string, Partial<CloudApiConfig>>>(CLOUD_CONFIGS_KEY)) || {};
    cloudConfigs[featureId] = {
      ...(cloudConfigs[featureId] || {}),
      ...config,
      id: featureId,
    };

    await settingsRepository.upsert(CLOUD_CONFIGS_KEY, cloudConfigs, '云端AI服务配置');

    return NextResponse.json({ requestId: reqId(), success: true, data: cloudConfigs[featureId] });
  } catch (err: unknown) {
    return NextResponse.json(
      { requestId: reqId(), success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
