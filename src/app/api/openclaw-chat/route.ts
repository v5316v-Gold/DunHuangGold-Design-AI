/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到 chat（统一对话入口）
 * 合并目标: /api/chat
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHAT_ROUTE = '/api/chat';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Forwarded-By': 'openclaw-chat-deprecated',
    };

    const auth = request.headers.get('Authorization');
    if (auth) headers['Authorization'] = auth;

    const forwarded = new Request(
      request.url.replace('/api/openclaw-chat', CHAT_ROUTE),
      {
        method: 'POST',
        headers,
        body,
      }
    );

    const response = await fetch(forwarded);
    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: { 'X-Deprecated-Source': 'openclaw-chat' },
    });
  } catch (error) {
    console.error('[openclaw-chat deprecated] 转发失败:', error);
    return NextResponse.json(
      { success: false, error: '路由已废弃，转发失败' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: '此路由已废弃，请使用 /api/chat',
      deprecated: true,
      migration: 'POST /api/chat',
    },
    { status: 410 }
  );
}
