import { NextRequest, NextResponse } from 'next/server';
import { createRateLimiter } from '@/lib/rate-limit';

// ==================== 速率限制配置 ====================

// AI 生成类接口（高消耗）：每分钟 20 次
const aiGenerationLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: 'rl:ai-gen',
  perPath: true,
});

// 对话类接口：每分钟 60 次
const chatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: 'rl:chat',
  perPath: false,
});

// 管理类接口：每分钟 30 次
const adminLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  keyPrefix: 'rl:admin',
  perPath: true,
});

// 通用接口：每分钟 100 次
const generalLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyPrefix: 'rl:general',
  perPath: false,
});

// ==================== 路径匹配 ====================

function getLimiter(pathname: string) {
  if (pathname.startsWith('/api/admin')) return adminLimiter;
  if (
    pathname.startsWith('/api/chat') ||
    pathname.startsWith('/api/ai-assistant')
  ) return chatLimiter;
  if (
    pathname.startsWith('/api/generate-image') ||
    pathname.startsWith('/api/image-3d') ||
    pathname.startsWith('/api/relief') ||
    pathname.startsWith('/api/video') ||
    pathname.startsWith('/api/one-click-design') ||
    pathname.startsWith('/api/product-refine') ||
    pathname.startsWith('/api/multi-image') ||
    pathname.startsWith('/api/multi-view') ||
    pathname.startsWith('/api/sketch-realistic') ||
    pathname.startsWith('/api/free-creation') ||
    pathname.startsWith('/api/stereo') ||
    pathname.startsWith('/api/upscale') ||
    pathname.startsWith('/api/remove-background') ||
    pathname.startsWith('/api/remove-watermark')
  ) return aiGenerationLimiter;
  if (pathname.startsWith('/api')) return generalLimiter;
  return null;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const limiter = getLimiter(pathname);

  if (!limiter) return NextResponse.next();

  const result = await limiter(request as unknown as Request);

  if (result === null) {
    // 不受限制，继续
    return NextResponse.next();
  }

  if (!result.allowed) {
    // 被限流
    return result.response;
  }

  // 放行：注入速率限制头
  const response = NextResponse.next();
  Object.entries(result.headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export const config = {
  matcher: [
    // 匹配所有路径除了静态文件和图标
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
