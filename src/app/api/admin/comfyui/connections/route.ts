/**
 * ComfyUI 连接管理 API
 * GET: 获取所有连接
 * POST: 创建/更新连接
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/storage/database/db';
import { memoryDb } from '@/storage/database/memory-db';
import { comfyuiConnections } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';
import { unauthorized } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function isDbAvailable(): Promise<boolean> {
  return await isDatabaseAvailable();
}

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

// 获取所有连接
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user || user.role !== 'admin') {
    return unauthorized();
  }

  try {
    let connections;

    if (await isDbAvailable()) {
      try {
        connections = await db!
          .select()
          .from(comfyuiConnections)
          .orderBy(comfyuiConnections.priority);

        connections = connections.map(mapConnection);
      } catch (dbError) {
        console.warn('[ComfyUI Connections] PostgreSQL查询失败，使用内存数据库:', dbError);
        const memConns = await memoryDb.connections.findMany();
        connections = memConns.map((c: any) => ({
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
        }));
      }
    } else {
      const memConns = await memoryDb.connections.findMany();
      connections = memConns.map((c: any) => ({
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
      }));
    }

    return NextResponse.json({ success: true, data: connections });
  } catch (err: unknown) {
    console.error('[ComfyUI Connections] GET错误:', err);
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

// 创建/更新连接
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user || user.role !== 'admin') {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const { id, name, host, port, authToken, enabled, isDefault, priority, timeout } = body;

    if (!id || !name || !host) {
      return NextResponse.json({ success: false, error: '缺少必填参数' }, { status: 400 });
    }

    const record = {
      id,
      name,
      host,
      port: port || 8188,
      authToken: authToken || '',
      enabled: enabled ?? true,
      isDefault: isDefault ?? false,
      priority: priority ?? 0,
      timeout: timeout ?? 120000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await memoryDb.connections.upsert(record);

    if (await isDbAvailable()) {
      try {
        if (isDefault) {
          await db!
            .update(comfyuiConnections)
            .set({ isDefault: false })
            .where(eq(comfyuiConnections.isDefault, true));
        }

        const existing = await db!
          .select()
          .from(comfyuiConnections)
          .where(eq(comfyuiConnections.id, id))
          .limit(1);

        if (existing.length > 0) {
          await db!
            .update(comfyuiConnections)
            .set({
              name,
              host,
              port: port || 8188,
              authToken: authToken,
              enabled: enabled ?? true,
              isDefault: isDefault ?? false,
              priority: priority ?? 0,
              timeout: timeout ?? 120000,
              updatedAt: new Date(),
            })
            .where(eq(comfyuiConnections.id, id));
        } else {
          await db!.insert(comfyuiConnections).values({
            id,
            name,
            host,
            port: port || 8188,
            authToken: authToken,
            enabled: enabled ?? true,
            isDefault: isDefault ?? false,
            priority: priority ?? 0,
            timeout: timeout ?? 120000,
          });
        }
      } catch (dbError) {
        console.warn('[ComfyUI Connections] PostgreSQL保存失败，使用内存数据库:', dbError);
      }
    }

    return NextResponse.json({ success: true, message: '连接已保存' });
  } catch (err: unknown) {
    console.error('[ComfyUI Connections] POST错误:', err);
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
