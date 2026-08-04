/**
 * @deprecated 此路由已废弃，请使用 POST /api/ai/generate (service: "free")
 * 90 天后将被删除。
 */
import { NextRequest, NextResponse } from 'next/server';
import { forwardToNewRoute } from '@/lib/deprecated-route';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return forwardToNewRoute(request, 'free', '/api/free-creation');
}


export async function GET() {
  return NextResponse.json(
    {  error: '此路由已废弃，请使用 POST /api/ai/generate' },
    { status: 410 }
  );
}