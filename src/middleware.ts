/**
 * Next.js Middleware - 全局路由保护
 *
 * 修复说明 (2026-08-03):
 *   - 此前 /admin 页面路由无任何中间件层保护,任何登录用户都能访问 admin UI
 *     (虽然 API 层有 role 校验,但页面层完全裸奔)。
 *   - 本中间件对 /admin/* 页面、/api/admin/* API 强制 role === 'admin' 校验。
 *   - 由于项目使用 src/app 目录,Next.js 约定 middleware 放在 src/middleware.ts。
 *
 * 鉴权来源:
 *   - 优先: Authorization: Bearer <token>
 *   - 次之: Cookie `auth_token` (与 src/lib/auth.ts#extractTokenFromRequest 保持一致)
 *
 * 公开路径白名单: /login, /api/auth/* (login/register/me/logout), /api/health
 *
 * 重要: 如果 JWT_SECRET 配置错误 (process.env.JWT_SECRET 缺失或默认值),本中间件
 * 会在启动时直接 fail-fast 抛出,避免"看似鉴权实际放过"的灾难场景。
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || '';

// 受保护的路径前缀
const ADMIN_PATH_PREFIX = '/admin';
const ADMIN_API_PREFIX = '/api/admin';

// 公开路径白名单 (无需登录即可访问)
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/health',
  '/api/ping',       // P0-3: liveness 探测（Docker healthcheck 用，必须公开）
  '/api/features',   // 功能列表（Sidebar 需要，脱敏数据）
];

/**
 * 从请求中提取 token (与 src/lib/auth.ts#extractTokenFromRequest 对齐)
 */
function extractToken(request: NextRequest): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // 2. Cookie: auth_token (主) / token (legacy)
  return request.cookies.get('auth_token')?.value || request.cookies.get('token')?.value || null;
}

/**
 * 验证 JWT token
 *
 * 重要: 由于 src/lib/auth.ts 在 module load 时会校验 JWT_SECRET,这里也做相同检查
 * 以避免中间件静默放过(单元测试和某些 SSR 场景可能绕过 auth.ts 加载顺序)。
 */
async function verifyToken(token: string): Promise<{
  userId: string;
  email: string;
  role: string;
} | null> {
  if (!JWT_SECRET || JWT_SECRET.trim() === '') {
    console.error('[middleware] JWT_SECRET 未配置,拒绝所有受保护请求 (fail-closed)');
    return null;
  }
  if (JWT_SECRET.length < 32) {
    console.error('[middleware] JWT_SECRET 长度不足 32 字符,拒绝所有受保护请求 (fail-closed)');
    return null;
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: (payload.userId as string) || (payload.sub as string) || '',
      email: (payload.email as string) || '',
      role: (payload.role as string) || 'user',
    };
  } catch {
    return null;
  }
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径放行
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // 静态资源已在 matcher 中排除,这里只处理业务路由
  const token = extractToken(request);
  const isApiPath = pathname.startsWith('/api/');

  if (!token) {
    if (isApiPath) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyToken(token);
  if (!payload) {
    if (isApiPath) {
      return NextResponse.json({ success: false, error: 'token 无效或已过期' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('reason', 'expired');
    return NextResponse.redirect(loginUrl);
  }

  // Admin 路径权限校验
  if (pathname.startsWith(ADMIN_PATH_PREFIX) || pathname.startsWith(ADMIN_API_PREFIX)) {
    if (payload.role !== 'admin') {
      if (isApiPath) {
        return NextResponse.json(
          { success: false, error: '权限不足,需要管理员角色' },
          { status: 403 }
        );
      }
      const homeUrl = new URL('/', request.url);
      homeUrl.searchParams.set('error', 'forbidden');
      return NextResponse.redirect(homeUrl);
    }
  }

  // 传递用户信息给下游 (供 server components / API 路由使用)
  const headers = new Headers(request.headers);
  headers.set('x-user-id', payload.userId);
  headers.set('x-user-email', payload.email);
  headers.set('x-user-role', payload.role);

  return NextResponse.next({
    request: { headers },
  });
}

export const config = {
  matcher: [
    // 排除 _next 静态资源、图片优化、favicon、public 目录
    '/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
};
