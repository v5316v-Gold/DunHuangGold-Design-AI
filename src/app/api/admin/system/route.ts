/**
 * GET /api/admin/system
 * 系统健康检查（Phase 9.26 · P2 恢复）
 *
 * 说明：Phase 9.24 清理时误删此路由，但 /admin/system 页面仍调用。
 * 恢复为轻量健康聚合（app/postgres/redis/comfyui/storage/thirdParty）。
 */
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { runSystemHealthCheck } from '@/lib/health/system-health';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json(
      { requestId: reqId(), success: false, error: '权限不足' },
      { status: 403 }
    );
  }

  try {
    const report = await runSystemHealthCheck();
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: report,
    });
  } catch (err) {
    return NextResponse.json(
      {
        requestId: reqId(),
        success: false,
        error: `健康检查失败: ${(err as Error).message}`,
      },
      { status: 500 }
    );
  }
}