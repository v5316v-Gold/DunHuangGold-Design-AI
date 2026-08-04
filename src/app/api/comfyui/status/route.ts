/**
 * ComfyUI 状态检查 API
 */

import { NextResponse } from 'next/server';
import { getComfyUISystemInfo } from '@/lib/comfyui-service';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';

/**
 * GET /api/comfyui/status
 * 检查 ComfyUI 是否在线
 */
export async function GET() {
  try {
    const stats = await getComfyUISystemInfo();
    
    if (!stats || !stats.success) {
      return NextResponse.json({
        requestId: reqId(), online: false,
        error: '无法连接到 ComfyUI'
      }, { status: 503 });
    }

    return NextResponse.json({
      requestId: reqId(), online: true,
      version: stats.stats?.system?.comfyui_version,
      ram: {
        total: Math.round((stats.stats?.memory?.ram_total || 0) / 1024 / 1024 / 1024 * 100) / 100,
        free: Math.round((stats.stats?.memory?.ram_free || 0) / 1024 / 1024 / 1024 * 100) / 100,
      }
    });

  } catch (error) {
    return NextResponse.json({
      requestId: reqId(), online: false,
      error: error instanceof Error ? error.message : '检查失败'
    }, { status: 500 });
  }
}
