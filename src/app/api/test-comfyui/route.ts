/**
 * @deprecated 测试路由已废弃，90 天后删除。
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: '此路由已废弃', deprecated: true },
    { status: 410 }
  );
}
