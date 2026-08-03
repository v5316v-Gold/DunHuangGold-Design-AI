import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/error-handler';
import { requireAuth } from '@/lib/auth';
import { unauthorized, badRequest, internalError } from '@/lib/api-response';

const logger = createLogger('proxy-image');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSRF 防护：检查 URL 是否指向私有 IP 段
 */
function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname;

    // 允许 localhost 的特殊情况（仅供开发环境）
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    // 检查是否为 IP 地址
    const ip = hostname.replace(/^\[|\]$/g, '');
    const parts = ip.split('.').map(Number);

    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      // 不是有效 IPV4，尝试 DNS 解析后检查（此处简化：非 IP 直接放行）
      return false;
    }

    // 10.0.0.0/8 — A 类私网
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 — B 类私网
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 — C 类私网
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 — 链路本地地址
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8 — 当前网络
    if (parts.every((p) => p === 0)) return true;

    return false;
  } catch {
    return true; // 无法解析的 URL视为不安全
  }
}

/**
 * 图片代理 API
 * 用于代理无法直接访问的图片 URL，解决 CORS 问题
 */
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    const { url } = await request.json();

    if (!url) {
      return badRequest('缺少 URL 参数');
    }

    // 验证 URL 格式
    try {
      new URL(url);
    } catch {
      return badRequest('无效的 URL 格式');
    }

    // SSRF 安全检查：禁止访问私有 IP
    if (isPrivateUrl(url)) {
      logger.warn('[proxy-image] SSRF 拦截私有地址:', url);
      return badRequest('不允许访问私有网络地址');
    }

    // 获取图片
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `图片获取失败: ${response.status}` },
        { status: response.status }
      );
    }

    // 检查内容类型
    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      return badRequest(`不是图片类型: ${contentType}`);
    }

    // 返回图片流
    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    logger.error('[proxy-image] 错误:', error);
    return internalError(error, '图片代理失败');
  }
}
