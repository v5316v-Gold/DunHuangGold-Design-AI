/**
 * 本地ComfyUI配置路由
 * GET: 获取所有功能的ComfyUI配置
 * POST: 更新单个功能的ComfyUI配置
 * DELETE: 重置单个功能的ComfyUI配置
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { unauthorized } from '@/lib/api-response';
import { FEATURE_DEFINITIONS, getFeature } from '@/config/features';
import { db } from '@/storage/database/db';
import { memoryDb } from '@/storage/database/memory-db';
import { comfyuiConfigs } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/* eslint-disable @typescript-eslint/no-explicit-any */


// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    const configs: Record<string, any> = {};

    for (const featureId of Object.keys(FEATURE_DEFINITIONS)) {
      const feature = getFeature(featureId);
      if (feature?.category === 'chat') continue;

      if (db) {
        const dbConfig = await db
          .select()
          .from(comfyuiConfigs)
          .where(eq(comfyuiConfigs.featureId, featureId))
          .limit(1);

        if (dbConfig.length > 0) {
          const c = dbConfig[0];
          configs[featureId] = {
            id: c.id,
            featureId: c.featureId,
            workflowId: c.workflowId,
            nodeMapping: c.nodeMapping,
            defaultParams: c.defaultParams,
            enabled: c.enabled,
            description: c.description,
          };
        } else {
          configs[featureId] = {
            id: featureId,
            featureId: featureId,
            workflowId: '',
            nodeMapping: {},
            defaultParams: {},
            enabled: false,
            description: '',
          };
        }
      } else {
        const memConfig = await memoryDb.configs.findFirst(featureId);
        if (memConfig) {
          configs[featureId] = {
            id: memConfig.id,
            featureId: memConfig.featureId,
            workflowId: memConfig.workflowId,
            nodeMapping: memConfig.nodeMapping,
            defaultParams: memConfig.defaultParams,
            enabled: memConfig.enabled,
            description: memConfig.description,
          };
        } else {
          configs[featureId] = {
            id: featureId,
            featureId: featureId,
            workflowId: '',
            nodeMapping: {},
            defaultParams: {},
            enabled: false,
            description: '',
          };
        }
      }
    }

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: configs,
    });
  } catch (err: unknown) {
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
    const body = await request.json();
    const { featureId, workflowId, nodeMapping, defaultParams, fixedParams, connectionId, enabled, description, workflowJson } = body;

    if (!featureId) {
      return NextResponse.json({
        requestId: reqId(), success: false,
        error: '缺少 featureId 参数',
      }, { status: 400 });
    }

    const feature = getFeature(featureId);
    if (!feature) {
      return NextResponse.json({
        requestId: reqId(), success: false,
        error: `功能不存在: ${featureId}`,
      }, { status: 400 });
    }

    const configData = {
      id: featureId,
      featureId: featureId,
      workflowId: workflowId || '',
      workflowJson: workflowJson || {},
      nodeMapping: nodeMapping || {},
      defaultParams: defaultParams || {},
      fixedParams: fixedParams || {},
      connectionId: connectionId || '',
      enabled: enabled ?? false,
      description: description || feature.description || '',
    };

    if (db) {
      const existing = await db
        .select()
        .from(comfyuiConfigs)
        .where(eq(comfyuiConfigs.featureId, featureId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(comfyuiConfigs)
          .set({
            workflowId: configData.workflowId,
            workflowJson: configData.workflowJson,
            nodeMapping: configData.nodeMapping,
            defaultParams: configData.defaultParams,
            fixedParams: configData.fixedParams,
            connectionId: configData.connectionId,
            enabled: configData.enabled,
            description: configData.description,
            updatedAt: new Date(),
          })
          .where(eq(comfyuiConfigs.featureId, featureId));
      } else {
        await db.insert(comfyuiConfigs).values(configData);
      }
    } else {
      await memoryDb.configs.upsert(configData as any);
    }

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: configData,
      message: `功能 ${featureId} 的ComfyUI配置已保存`,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      requestId: reqId(), success: false,
      error: (err instanceof Error ? err.message : String(err)),
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authUser = await requireAuth(request);
  if (!authUser) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const featureId = searchParams.get('featureId');

    if (!featureId) {
      return NextResponse.json({
        requestId: reqId(), success: false,
        error: '缺少 featureId 参数',
      }, { status: 400 });
    }

    if (db) {
      await db
        .delete(comfyuiConfigs)
        .where(eq(comfyuiConfigs.featureId, featureId));
    } else {
      await memoryDb.configs.delete(featureId);
    }

    return NextResponse.json({
      requestId: reqId(), success: true,
      message: `已重置 ${featureId} 的ComfyUI配置`,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      requestId: reqId(), success: false,
      error: (err instanceof Error ? err.message : String(err)),
    }, { status: 500 });
  }
}
