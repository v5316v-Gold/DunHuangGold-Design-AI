/**
 * @deprecated 调试路由已废弃，90 天后删除。
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export async function GET() {
  return NextResponse.json(
    {  error: '此路由已废弃', deprecated: true },
    { status: 410 }
  );
}
