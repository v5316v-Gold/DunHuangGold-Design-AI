/**
 * 废弃路由转发工具
 *
 * 用于将旧路由请求转发到新的 /api/ai/generate 统一入口。
 * 旧路由保留（向后兼容），新增 @deprecated 标记。
 */

import { NextRequest, NextResponse } from 'next/server';
import type { AIServiceType } from './ai-service/types';

const NEW_ROUTE = '/api/ai/generate';

/**
 * 创建废弃路由的转发响应
 *
 * @param request 原始请求
 * @param service 新的 service 类型
 * @param deprecatedRoute 废弃的路由路径（仅用于日志）
 */
export async function forwardToNewRoute(
  request: NextRequest,
  service: AIServiceType,
  deprecatedRoute: string
): Promise<NextResponse> {
  try {
    const body = await request.json();

    // 记录废弃警告
    console.warn(
      `[deprecated] ${deprecatedRoute} 已废弃，请使用 ${NEW_ROUTE}。` +
      ` 将在 90 天后删除此路由。`
    );

    // 转发到新路由
    const newBody = { service, ...body };

    const response = await fetch(new URL(NEW_ROUTE, request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 透传原始请求的 Authorization
        ...(request.headers.get('Authorization')
          ? { Authorization: request.headers.get('Authorization')! }
          : {}),
        // 透传真实 IP
        ...(request.headers.get('X-Real-IP')
          ? { 'X-Real-IP': request.headers.get('X-Real-IP')! }
          : {}),
        ...(request.headers.get('X-Forwarded-For')
          ? { 'X-Forwarded-For': request.headers.get('X-Forwarded-For')! }
          : {}),
      },
      body: JSON.stringify(newBody),
    });

    // 返回新路由的响应
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`[deprecated] ${deprecatedRoute} 转发失败:`, error);
    return NextResponse.json(
      { success: false, error: '路由已废弃，转发失败' },
      { status: 500 }
    );
  }
}
