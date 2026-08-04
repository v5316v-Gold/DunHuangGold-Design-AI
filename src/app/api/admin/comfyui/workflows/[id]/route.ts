/**
 * ComfyUI 单个工作流管理 API
 * GET: 获取单个工作流
 * PUT: 更新工作流
 * DELETE: 删除工作流
 * POST: 启用/禁用
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

// 获取单个工作流
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getCurrentUser(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: "数据库未配置" }, { status: 503 });
  const { id } = await params;
  
  try {
    const workflows = await db
      .select()
      .from(comfyuiConfigs)
      .where(eq(comfyuiConfigs.id, id))
      .limit(1);

    if (workflows.length === 0) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '工作流不存在' }, { status: 404 });
    }

    const w = workflows[0];
    
    let connection = null;
    if (w.connectionId) {
      const connections = await db
        .select()
        .from(comfyuiConnections)
        .where(eq(comfyuiConnections.id, w.connectionId))
        .limit(1);
      if (connections.length > 0) {
        const c = connections[0];
        connection = {
          id: c.id,
          name: c.name,
          host: c.host,
          port: c.port,
        };
      }
    }

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: mapWorkflow(w, connection),
    });
  } catch (err: unknown) {
    return NextResponse.json({ requestId: reqId(), success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

// 更新工作流
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getCurrentUser(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: "数据库未配置" }, { status: 503 });
  const { id } = await params;
  
  try {
    const body = await request.json();
    const {
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

    if (isDefault) {
      const workflow = await db
        .select()
        .from(comfyuiConfigs)
        .where(eq(comfyuiConfigs.id, id))
        .limit(1);
      
      if (workflow.length > 0) {
        await db
          .update(comfyuiConfigs)
          .set({ isDefault: false })
          .where(eq(comfyuiConfigs.featureId, workflow[0].featureId));
      }
    }

    await db
      .update(comfyuiConfigs)
      .set({
        featureId: featureId ?? undefined,
        workflowJson: workflowJson ?? undefined,
        nodeMapping: nodeMapping ?? undefined,
        defaultParams: defaultParams ?? undefined,
        fixedParams: fixedParams ?? undefined,
        connectionId: connectionId ?? undefined,
        enabled: enabled ?? undefined,
        isDefault: isDefault ?? undefined,
        description: description ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(comfyuiConfigs.id, id));

    return NextResponse.json({ requestId: reqId(), success: true, message: '工作流已更新' });
  } catch (err: unknown) {
    return NextResponse.json({ requestId: reqId(), success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

// 删除工作流
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getCurrentUser(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: "数据库未配置" }, { status: 503 });
  const { id } = await params;
  
  try {
    await db.delete(comfyuiConfigs).where(eq(comfyuiConfigs.id, id));
    return NextResponse.json({ requestId: reqId(), success: true, message: '工作流已删除' });
  } catch (err: unknown) {
    return NextResponse.json({ requestId: reqId(), success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

// 启用/禁用
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await getCurrentUser(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: "数据库未配置" }, { status: 503 });
  const { id } = await params;
  
  try {
    const body = await request.json();
    const { action, enabled } = body;

    if (action === 'enable' || action === 'disable') {
      await db
        .update(comfyuiConfigs)
        .set({
          enabled: action === 'enable',
          updatedAt: new Date(),
        })
        .where(eq(comfyuiConfigs.id, id));

      return NextResponse.json({ 
        requestId: reqId(), success: true, 
        message: action === 'enable' ? '工作流已启用' : '工作流已禁用' 
      });
    }

    if (typeof enabled === 'boolean') {
      await db
        .update(comfyuiConfigs)
        .set({
          enabled,
          updatedAt: new Date(),
        })
        .where(eq(comfyuiConfigs.id, id));

      return NextResponse.json({ 
        requestId: reqId(), success: true, 
        message: enabled ? '工作流已启用' : '工作流已禁用' 
      });
    }

    return NextResponse.json({ requestId: reqId(), success: false, error: '未知操作' }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json({ requestId: reqId(), success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
