import { NextRequest, NextResponse } from 'next/server';
import { PerformanceMonitor, checkPerformanceHealth } from '@/lib/performance-monitor';
import { requireAuth } from '@/lib/auth';
import { unauthorized } from '@/lib/api-response';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

/**
 * 性能监控 API
 * GET /api/performance/metrics - 获取性能指标
 * GET /api/performance/health - 获取健康状态
 * DELETE /api/performance/metrics - 清除性能指标
 */

export const runtime = 'nodejs';

// 获取性能指标
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user || user.role !== 'admin') return unauthorized();
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const monitor = PerformanceMonitor.getInstance();

    if (action === 'health') {
      // 获取健康状态
      const health = checkPerformanceHealth({
        memoryWarning: 80,
        memoryCritical: 90,
        slowQueryThreshold: 5000,
      });

      return NextResponse.json({
        requestId: reqId(), success: true,
        data: health,
      });
    }

    if (action === 'stats') {
      // 获取统计信息
      const name = searchParams.get('name');
      if (!name) {
        return NextResponse.json(
          {  error: '缺少 name 参数' },
          { status: 400 }
        );
      }

      const stats = monitor.getStats(name);
      return NextResponse.json({
        requestId: reqId(), success: true,
        data: stats,
      });
    }

    // 获取所有指标
    const name = searchParams.get('name');
    const metrics = name ? monitor.getMetricsByName(name) : monitor.getMetrics();

    // 限制返回数量
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const limitedMetrics = metrics.slice(-limit);

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: limitedMetrics,
      total: metrics.length,
    });
  } catch (error) {
    console.error('[performance-metrics] 错误:', error);
    return NextResponse.json(
      {  error: '获取性能指标失败' },
      { status: 500 }
    );
  }
}

// 清除性能指标
export async function DELETE(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user || user.role !== 'admin') return unauthorized();
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    const monitor = PerformanceMonitor.getInstance();

    if (name) {
      monitor.clearByName(name);
    } else {
      monitor.clear();
    }

    return NextResponse.json({
      requestId: reqId(), success: true,
      message: name ? `已清除 ${name} 的指标` : '已清除所有指标',
    });
  } catch (error) {
    console.error('[performance-metrics] 清除失败:', error);
    return NextResponse.json(
      {  error: '清除性能指标失败' },
      { status: 500 }
    );
  }
}
