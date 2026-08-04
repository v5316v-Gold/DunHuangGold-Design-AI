import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllFeaturesStatus } from '@/lib/api-config-service';
import { isFeatureEnabled } from '@/config/api-config';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

/**
 * GET /api/admin/features-status
 * 获取所有设计工坊功能的启用状态
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }
    // 获取所有功能状态（异步初始化配置）
    const status = await getAllFeaturesStatus();

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: status,
    });
  } catch (error) {
    console.error('获取功能状态失败:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : '获取功能状态失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/features-status
 * 检查特定功能的启用状态
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }
    const { featureId } = await request.json();

    if (!featureId) {
      return NextResponse.json(
        { 
          success: false,
          error: '缺少 featureId 参数',
        },
        { status: 400 }
      );
    }

    const status = isFeatureEnabled(featureId);

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: status,
    });
  } catch (error) {
    console.error('检查功能状态失败:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : '检查功能状态失败',
      },
      { status: 500 }
    );
  }
}
