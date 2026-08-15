import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/error-handler';
import { requireAuth } from '@/lib/auth';
import { unauthorized, badRequest, internalError } from '@/lib/api-response';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

const logger = createLogger('proxy-image');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 最大响应体上限（10MB，防内存耗尽）
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
// 上游请求超时（15s）
const FETCH_TIMEOUT_MS = 15_000;

/**
 * 是否为私有/保留 IPv4 地址
 * 覆盖：私网（10/8、172.16/12、192.168/16）、回环（127/8）、链路本地（169.254/16）、
 * CGNAT（100.64/10）、0.0.0.0/8、文档/测试保留段、组播（224/4）、保留段（240/4）
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true; // 非法格式视为不安全
  const [a, b, c] = parts;

  // 0.0.0.0/8 — 本网络
  if (a === 0) return true;
  // 10.0.0.0/8 — A 类私网
  if (a === 10) return true;
  // 100.64.0.0/10 — CGNAT 共享地址段
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 — 回环
  if (a === 127) return true;
  // 169.254.0.0/16 — 链路本地
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 — B 类私网
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 — IETF 保留
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24 — TEST-NET-1
  if (a === 192 && b === 0 && c === 2) return true;
  // 192.168.0.0/16 — C 类私网
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 — 网络基准测试
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 — TEST-NET-2
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 — TEST-NET-3
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 — 组播
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 — 保留段（含 255.255.255.255）
  if (a >= 240) return true;

  return false;
}

/**
 * 是否为私有/保留 IPv6 地址
 * 覆盖：::1 回环、:: 未指定、fc00::/7 ULA、fe80::/10 链路本地、
 * fec0::/10 已废弃 site-local、ff00::/8 组播、2001:db8::/32 文档段
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // ::1 — 回环
  if (normalized === '::1') return true;
  // :: — 未指定
  if (normalized === '::') return true;
  // ::ffff:x.x.x.x — IPv4 映射地址，提取内嵌 IPv4 判断
  const v4Mapped = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4Mapped) return isPrivateIPv4(v4Mapped[1]);
  // ::ffff:0:0/96 的十六进制形式（如 ::ffff:7f00:1）同样按映射处理，统一拒绝
  if (normalized.startsWith('::ffff:')) return true;
  // fc00::/7 — 唯一本地地址（ULA）
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  // fe80::/10 — 链路本地
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
      normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  // fec0::/10 — 已废弃 site-local
  if (normalized.startsWith('fec') || normalized.startsWith('fed') ||
      normalized.startsWith('fee') || normalized.startsWith('fef')) return true;
  // ff00::/8 — 组播
  if (normalized.startsWith('ff')) return true;
  // 2001:db8::/32 — 文档示例段
  if (normalized.startsWith('2001:db8')) return true;

  return false;
}

/**
 * 判断单个 IP 是否为私有/保留地址（支持 IPv4 / IPv6 / IPv4 映射地址）
 * 无法识别的格式一律视为不安全（默认拒绝）
 */
function isPrivateIP(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIPv4(address);
  if (family === 6) return isPrivateIPv6(address);
  // IPv4 映射地址（::ffff:x.x.x.x）isIP 判定为 6，已在 isPrivateIPv6 内处理
  return true;
}

/**
 * SSRF 防护（默认拒绝策略）：
 * 1. 仅允许 http/https 协议
 * 2. DNS 解析 hostname 的所有地址，任一为私有/回环地址即拒绝
 * 3. 解析失败 / 无法解析出地址 → 拒绝（防 DNS 重绑定绕过）
 */
async function isUrlAllowed(urlStr: string): Promise<{ ok: boolean; reason?: string }> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { ok: false, reason: 'URL 格式无效' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: '仅允许 http/https 协议' };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname) {
    return { ok: false, reason: '缺少主机名' };
  }

  try {
    // all: true 解析全部地址，防止只检查单个 A 记录导致重绑定绕过
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (!records.length) {
      return { ok: false, reason: '主机名无解析结果' };
    }
    for (const record of records) {
      if (isPrivateIP(record.address)) {
        return { ok: false, reason: `解析到私有网络地址: ${record.address}` };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'DNS 解析失败' };
  }
}

/**
 * 流式读取响应体并限制大小，防止代理超大响应导致内存耗尽
 */
async function readBodyWithLimit(response: Response, limit: number): Promise<ArrayBuffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    const buf = await response.arrayBuffer();
    if (buf.byteLength > limit) {
      throw new Error(`响应体超过大小上限（${limit} 字节）`);
    }
    return buf;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new Error(`响应体超过大小上限（${limit} 字节）`);
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
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

    // SSRF 安全检查（默认拒绝策略）：协议白名单 + DNS 解析 + 私有地址拦截
    const check = await isUrlAllowed(url);
    if (!check.ok) {
      logger.warn('[proxy-image] SSRF 拦截:', url, check.reason);
      return badRequest(`不允许访问该地址: ${check.reason}`);
    }

    // 获取图片（禁止跟随重定向，防止重定向到内网；设置超时）
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      logger.warn('[proxy-image] 上游请求失败:', url, err);
      return badRequest('图片获取失败，请检查 URL 是否可访问');
    }

    // 重定向响应（3xx）一律拒绝，防止重定向到内网地址
    if (response.status >= 300 && response.status < 400) {
      logger.warn('[proxy-image] 拒绝重定向:', url, response.status);
      return badRequest('不允许重定向到其他地址');
    }

    if (!response.ok) {
      return NextResponse.json(
        {  success: false, error: `图片获取失败: ${response.status}` },
        { status: response.status }
      );
    }

    // 检查内容类型
    const contentType = response.headers.get('content-type');
    if (!contentType?.startsWith('image/')) {
      return badRequest(`不是图片类型: ${contentType}`);
    }

    // 流式读取并限制大小（防内存耗尽）
    const imageBuffer = await readBodyWithLimit(response, MAX_RESPONSE_BYTES);

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    // 响应体超限 → 400，其余按内部错误处理
    if (error instanceof Error && error.message.includes('响应体超过大小上限')) {
      logger.warn('[proxy-image] 响应体超过大小上限');
      return badRequest('图片文件过大');
    }
    logger.error('[proxy-image] 错误:', error);
    return internalError(error, '图片代理失败');
  }
}
