/**
 * GET /api/ping
 *
 * P0-3 · Liveness 探测（容器存活判定）
 *
 * 与 /api/health 的区别：
 *   - /api/ping：永远 200（进程活着即通过），用于 Docker healthcheck / 负载均衡存活判定
 *   - /api/health：readiness（真实探测 DB/Redis/AI keys，依赖降级返回 503 degraded）
 *
 * 为什么拆分：
 *   容器 healthcheck 期望 200 判定存活，但 /api/health 在依赖降级时返回 503
 *   → 会导致"应用活着但因 Redis 降级被 Docker 反复重启"的误判。
 *   ping 只验证进程存活，health 供外部监控判断服务可用性。
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
