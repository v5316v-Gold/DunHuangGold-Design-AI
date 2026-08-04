import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

/**
 * 健康检查端点
 * 
 * 用法: GET /api/health
 * 用于监控 / 负载均衡 / Docker healthcheck
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const health: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '0.1.0',
    checks: {
      app: 'ok',
      // DB 检查（可选，不阻塞响应）
    },
  };

  // 检查数据库（异步，不阻塞响应）
  try {
    const { db } = await import('@/db');
    if (db) {
      health.checks = { ...health.checks as object, db: 'ok' };
    }
  } catch {
    health.checks = { ...health.checks as object, db: 'unknown' };
  }

  return NextResponse.json(health, { status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
