import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { unauthorized, badRequest, forbidden, internalError } from '@/lib/api-response';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

// 允许代理的域名白名单（Meshy CDN）
const ALLOWED_DOMAIN = 'meshy.ai';

/**
 * hostname 是否命中 Meshy 白名单：
 * 精确等于 meshy.ai，或以 .meshy.ai 结尾（前面必须有实际子域段，如 assets.meshy.ai）
 * meshy.ai.evil.com、evil-meshy.ai 等均不命中
 */
function isAllowedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === ALLOWED_DOMAIN || h.endsWith(`.${ALLOWED_DOMAIN}`);
}

/**
 * 是否为私有/保留 IPv4 地址（覆盖私网、回环、链路本地、CGNAT、组播、保留段）
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true; // 非法格式视为不安全
  const [a, b, c] = parts;

  if (a === 0) return true;                                      // 0.0.0.0/8
  if (a === 10) return true;                                     // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true;             // 100.64.0.0/10 CGNAT
  if (a === 127) return true;                                    // 127.0.0.0/8 回环
  if (a === 169 && b === 254) return true;                       // 169.254.0.0/16 链路本地
  if (a === 172 && b >= 16 && b <= 31) return true;              // 172.16.0.0/12
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true; // 192.0.0.0/24、192.0.2.0/24
  if (a === 192 && b === 168) return true;                       // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true;          // 198.18.0.0/15 基准测试
  if (a === 198 && b === 51 && c === 100) return true;           // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true;            // 203.0.113.0/24 TEST-NET-3
  if (a >= 224 && a <= 239) return true;                         // 224.0.0.0/4 组播
  if (a >= 240) return true;                                     // 240.0.0.0/4 保留段

  return false;
}

/**
 * 是否为私有/保留 IPv6 地址（回环、ULA、链路本地、组播、IPv4 映射）
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === '::1' || normalized === '::') return true;  // 回环 / 未指定
  const v4Mapped = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4Mapped) return isPrivateIPv4(v4Mapped[1]);               // IPv4 映射
  if (normalized.startsWith('::ffff:')) return true;             // 映射地址十六进制形式
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;  // fc00::/7 ULA
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
      normalized.startsWith('fea') || normalized.startsWith('feb')) return true; // fe80::/10 链路本地
  if (normalized.startsWith('fec') || normalized.startsWith('fed') ||
      normalized.startsWith('fee') || normalized.startsWith('fef')) return true; // fec0::/10 site-local
  if (normalized.startsWith('ff')) return true;                  // ff00::/8 组播
  if (normalized.startsWith('2001:db8')) return true;            // 2001:db8::/32 文档段

  return false;
}

/**
 * 判断单个 IP 是否私有/保留（无法识别一律视为不安全）
 */
function isPrivateIP(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  return true;
}

/**
 * 解析 hostname 的全部地址，任一为私有地址即视为不安全（防 DNS 重绑定）
 */
async function isHostResolvesPublic(hostname: string): Promise<boolean> {
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records.length) return false;
    return records.every((record) => !isPrivateIP(record.address));
  } catch {
    return false; // 解析失败 → 拒绝
  }
}

/**
 * 模型文件代理（解决跨域问题）
 * 将 Meshy CDN 的模型文件代理到同源，避免 model-viewer 的 CORS 限制
 */
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const modelUrl = searchParams.get('url');

  if (!modelUrl) {
    return badRequest('缺少 url 参数');
  }

  // 解析式白名单校验：URL 必须可解析、仅 http/https、无 userinfo、hostname 命中 Meshy 白名单
  let url: URL;
  try {
    url = new URL(modelUrl);
  } catch {
    return badRequest('无效的 URL 格式');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return forbidden('不允许代理此 URL');
  }

  // 拒绝 @ 形式 userinfo（如 http://user:pass@host/）
  if (url.username || url.password) {
    return forbidden('不允许代理此 URL');
  }

  // hostname 精确命中白名单（meshy.ai 或其子域）
  if (!isAllowedHost(url.hostname)) {
    return forbidden('不允许代理此 URL');
  }

  // IP 私有判断：解析出的所有地址必须均为公网地址（防 DNS 重绑定到内网）
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (!(await isHostResolvesPublic(hostname))) {
    return forbidden('不允许代理此 URL');
  }

  try {
    console.log('[proxy-model] 代理请求:', modelUrl.substring(0, 80));
    // redirect: 'manual' 禁止跟随重定向，防止重定向到内网
    const response = await fetch(modelUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(60_000),
    });

    // 重定向响应（3xx）一律拒绝
    if (response.status >= 300 && response.status < 400) {
      return forbidden('不允许代理重定向地址');
    }

    if (!response.ok) {
      return NextResponse.json(
        {  success: false, error: `模型文件获取失败: ${response.status}` },
        { status: 502 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'model/gltf-binary',
        'Content-Length': String(arrayBuffer.byteLength),
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[proxy-model] 代理失败:', error);
    return internalError(error, '代理请求失败');
  }
}
