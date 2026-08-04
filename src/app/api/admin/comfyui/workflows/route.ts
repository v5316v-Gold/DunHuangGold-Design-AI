/**
 * ComfyUI 工作流管理 API
 * GET: 获取所有工作流（支持按 featureId 筛选）
 * POST: 创建/更新工作流
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/storage/database/db';
import { comfyuiConfigs, comfyuiConnections } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapWorkflow(w: typeof comfyuiConfigs.$inferSelect, connection: any = null) {
  return {
    id: w.id,
    featureId: w.featureId,
    workflowId: w.workflowId,
    workflowJson: w.workflowJson,
    nodeMapping: w.nodeMapping || {},
    defaultParams: w.defaultParams || {},
    fixedParams: w.fixedParams || {},
    connectionId: w.connectionId,
    connection,
    enabled: w.enabled,
    isDefault: w.isDefault,
    description: w.description,
    executionCount: w.executionCount || 0,
    lastExecutedAt: w.lastExecutedAt,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

// 获取所有工作流
export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: "数据库未配置" }, { status: 503 });
  try {
    const { searchParams } = new URL(request.url);
    const featureId = searchParams.get('featureId');

    let workflows;
    if (featureId) {
      workflows = await db
        .select()
        .from(comfyuiConfigs)
        .where(eq(comfyuiConfigs.featureId, featureId));
    } else {
      workflows = await db.select().from(comfyuiConfigs);
    }

    const connections = await db.select().from(comfyuiConnections);
    const connectionMap = new Map(connections.map(c => [c.id, c]));

    const result = workflows.map(w => {
      const conn = w.connectionId ? connectionMap.get(w.connectionId) : null;
      return mapWorkflow(w, conn ? { id: conn.id, name: conn.name, host: conn.host, port: conn.port } : null);
    });

    return NextResponse.json({ requestId: reqId(), success: true, data: result });
  } catch (err: unknown) {
    return NextResponse.json({ requestId: reqId(), success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

// 创建/更新工作流
export async function POST(request: NextRequest) {
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: "数据库未配置" }, { status: 503 });
  try {
    const body = await request.json();
    const {
      id,
      featureId,
      workflowJson,
      nodeMapping,
      defaultParams,
      fixedParams,
      connectionId,
      enabled,
      isDefault,
      description,
    } = body;

    if (!id || !featureId) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少必填参数 id 或 featureId' }, { status: 400 });
    }

    if (isDefault) {
      await db
        .update(comfyuiConfigs)
        .set({ isDefault: false })
        .where(eq(comfyuiConfigs.featureId, featureId));
    }

    const existing = await db
      .select()
      .from(comfyuiConfigs)
      .where(eq(comfyuiConfigs.id, id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(comfyuiConfigs)
        .set({
          featureId: featureId,
          workflowJson: workflowJson,
          nodeMapping: nodeMapping || {},
          defaultParams: defaultParams || {},
          fixedParams: fixedParams || {},
          connectionId: connectionId,
          enabled: enabled ?? false,
          isDefault: isDefault ?? false,
          description: description || null,
          updatedAt: new Date(),
        })
        .where(eq(comfyuiConfigs.id, id));

      return NextResponse.json({ requestId: reqId(), success: true, message: '工作流已更新' });
    } else {
      await db.insert(comfyuiConfigs).values({
        id,
        featureId: featureId,
        workflowJson: workflowJson,
        nodeMapping: nodeMapping || {},
        defaultParams: defaultParams || {},
        fixedParams: fixedParams || {},
        connectionId: connectionId,
        enabled: enabled ?? false,
        isDefault: isDefault ?? false,
        description: description || null,
        executionCount: 0,
      });

      return NextResponse.json({ requestId: reqId(), success: true, message: '工作流已创建' });
    }
  } catch (err: unknown) {
    return NextResponse.json({ requestId: reqId(), success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
