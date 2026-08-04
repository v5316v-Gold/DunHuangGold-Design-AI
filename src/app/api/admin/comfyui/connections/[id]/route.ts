/**
 * ComfyUI 单个连接管理 API
 * GET: 获取单个连接
 * PUT: 更新连接
 * DELETE: 删除连接
 * POST: 测试连接
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/storage/database/db';
import { comfyuiConnections } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapConnection(c: typeof comfyuiConnections.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    host: c.host,
    port: c.port,
    authToken: c.authToken,
    enabled: c.enabled,
    isDefault: c.isDefault,
    priority: c.priority,
    timeout: c.timeout,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

// 获取单个连接
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
    const connections = await db
      .select()
      .from(comfyuiConnections)
      .where(eq(comfyuiConnections.id, id))
      .limit(1);

    if (connections.length === 0) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '连接不存在' }, { status: 404 });
    }

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: mapConnection(connections[0]),
    });
  } catch (err: unknown) {
    return NextResponse.json({ requestId: reqId(), success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

// 更新连接
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
    const { name, host, port, authToken, enabled, isDefault, priority, timeout } = body;

    if (isDefault) {
      await db
        .update(comfyuiConnections)
        .set({ isDefault: false })
        .where(eq(comfyuiConnections.isDefault, true));
    }

    await db
      .update(comfyuiConnections)
      .set({
        name: name ?? undefined,
        host: host ?? undefined,
        port: port ?? undefined,
        authToken: authToken ?? undefined,
        enabled: enabled ?? undefined,
        isDefault: isDefault ?? undefined,
        priority: priority ?? undefined,
        timeout: timeout ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(comfyuiConnections.id, id));

    return NextResponse.json({ requestId: reqId(), success: true, message: '连接已更新' });
  } catch (err: unknown) {
    return NextResponse.json({ requestId: reqId(), success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

// 删除连接
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
    await db.delete(comfyuiConnections).where(eq(comfyuiConnections.id, id));
    return NextResponse.json({ requestId: reqId(), success: true, message: '连接已删除' });
  } catch (err: unknown) {
    return NextResponse.json({ requestId: reqId(), success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

// 测试连接
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
    const connections = await db
      .select()
      .from(comfyuiConnections)
      .where(eq(comfyuiConnections.id, id))
      .limit(1);

    if (connections.length === 0) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '连接不存在' }, { status: 404 });
    }

    const connection = connections[0];
    const url = `http://${connection.host}:${connection.port}/system_stats`;

    const start = Date.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: connection.authToken ? { Authorization: `Bearer ${connection.authToken}` } : {},
    });
    const latency = Date.now() - start;

    if (response.ok) {
      const stats = await response.json();
      return NextResponse.json({
        requestId: reqId(), success: true,
        data: {
          online: true,
          version: stats.version,
          cudaAvailable: stats.cuda_available,
          gpuMemory: stats.gpu_memory ? `${Math.round(stats.gpu_memory / 1024)}GB` : null,
          latencyMs: latency,
        },
      });
    } else {
      return NextResponse.json({
        requestId: reqId(), success: true,
        data: {
          online: false,
          error: `HTTP ${response.status}`,
          latencyMs: latency,
        },
      });
    }
  } catch (err: unknown) {
    return NextResponse.json({
      requestId: reqId(), success: true,
      data: {
        online: false,
        error: (err instanceof Error ? err.message : String(err)),
      },
    });
  }
}
