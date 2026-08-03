/**
 * 系统健康检查 API
 *
 * GET /api/admin/system
 *   - requireAdmin 鉴权（role === 'admin'，middleware 已做边缘校验，这里双保险）
 *   - 调 runSystemHealthCheck() 并行聚合探测 postgres/redis/workers/comfyui/storage/thirdParty
 *   - 写审计日志（action: 'system.health-check'）
 *   - 返回 { success, data: SystemHealthReport, error, meta }
 *
 * 注意：探测为并行执行，整体耗时约 3-5 秒（含超时保护），无需特殊响应配置。
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { runSystemHealthCheck } from '@/lib/health/system-health';
import { logAudit } from '@/lib/audit-logger';
import { apiSuccess, unauthorized, internalError } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 管理员鉴权（role === 'admin'）
 * 内联实现，与其它 /api/admin/* 路由保持一致
 */
async function requireAdmin(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}

/**
 * GET /api/admin/system
 * 执行全部健康检查并返回报告
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();

  try {
    const report = await runSystemHealthCheck();

    // 写审计日志（失败不阻断响应）
    await logAudit({
      action: 'system.health-check',
      resourceType: 'system',
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      details: {
        status: report.status,
        timestamp: report.timestamp,
        checkCount: Object.keys(report.checks).length,
      },
    });

    return apiSuccess(report, {
      error: null,
      meta: { generatedAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error('[api/admin/system] 健康检查失败:', err);
    return internalError(err, '健康检查失败');
  }
}
