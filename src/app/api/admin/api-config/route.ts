/**
 * /api/admin/api-config
 * 管理员 · API 配置（api_configs 表）
 *
 * GET  /api/admin/api-config?action=list   - 配置列表（前端 ApiManagerModal 期望 data 为数组）
 * POST /api/admin/api-config               - 保存（upsert by id；兼容 action: create/update/toggle）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { apiConfigs, apiConfigSecrets } from '@/db/schema/_tables';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { encryptSecret, maskApiKey, hasEncryptionKey } from '@/lib/secret-vault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

/** api_configs 可写字段映射（仅取 body 中出现的字段，避免覆盖其他配置项） */
function pickFields(body: Record<string, unknown>): Record<string, unknown> {
  const map: Array<[string, string]> = [
    ['name', 'name'],
    ['apiKey', 'apiKey'],
    ['provider', 'provider'],
    ['model', 'model'],
    ['url', 'url'],
    ['method', 'method'],
    ['enabled', 'enabled'],
    ['timeout', 'timeout'],
    ['headers', 'headers'],
    ['paramMapping', 'paramMapping'],
    ['responseMapping', 'responseMapping'],
    ['fallback', 'fallback'],
    ['description', 'description'],
    ['appId', 'appId'],
    ['disableThoughtChain', 'disableThoughtChain'],
    ['enableAdvancedParams', 'enableAdvancedParams'],
    ['filterThoughtOutput', 'filterThoughtOutput'],
    ['translateModel', 'translateModel'],
    ['optimizeModel', 'optimizeModel'],
    ['vlmModel', 'vlmModel'],
    ['showOnAssistant', 'showOnAssistant'],
  ];
  const out: Record<string, unknown> = {};
  for (const [bodyKey, colKey] of map) {
    if (body[bodyKey] !== undefined) out[colKey] = body[bodyKey];
  }
  return out;
}

// ==================== GET ====================

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: true, data: [], warning: '数据库未配置' });
  }
  const dbc = db as NonNullable<typeof db>;

  try {
    const rows = await dbc.select().from(apiConfigs).orderBy(apiConfigs.createdAt);
    // W1·API Key 防泄漏:前端仅看到 masked / hasKey
    const masked = rows.map((r) => {
      const raw = r.apiKey || '';
      let hasKey = false;
      if (raw && !raw.startsWith('your-') && !raw.includes('*') && raw.length > 6) {
        hasKey = true;
      }
      const maskedKey = raw && hasKey ? `${'*'.repeat(Math.max(raw.length - 4, 4))}${raw.slice(-4)}` : '';
      return {
        ...r,
        apiKey: maskedKey,
        hasKey,
      };
    });
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: masked,
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: [],
      warning: `查询失败（api_configs 表可能不存在）: ${(err as Error).message}`,
    });
  }
}

// ==================== POST（保存 / upsert） ====================

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const id = typeof body.id === 'string' && body.id ? body.id : null;
  if (!id) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 id' }, { status: 400 });
  }

  const dbc = db as NonNullable<typeof db>;
  try {
    // toggle 动作：翻转 enabled
    if (body.action === 'toggle') {
      const [row] = await dbc.select({ enabled: apiConfigs.enabled }).from(apiConfigs).where(eq(apiConfigs.id, id)).limit(1);
      const next = row ? !row.enabled : true;
      await dbc
        .update(apiConfigs)
        .set({ enabled: next, updatedAt: new Date() })
        .where(eq(apiConfigs.id, id));
      return NextResponse.json({ requestId: reqId(), success: true, data: { id, enabled: next } });
    }

    // create / update / 默认：upsert
    const fields = pickFields(body) as Partial<typeof apiConfigs.$inferInsert>;

    // W1 · 写路径强制加密：先 upsert 主页（apiKey 替换为脱敏值，保证 FK 目标行存在），
    // 再 upsert secrets 密文。apiKey 非空时加密；为空表示未改/清空，保留主页原值+secrets。
    if (typeof body.apiKey === 'string' && body.apiKey.length > 0) {
      if (!hasEncryptionKey()) {
        return NextResponse.json({
          requestId: reqId(), success: false,
          error: '服务端未配置 API_KEY_ENCRYPTION_KEY（64 hex），无法安全保存 API Key',
        }, { status: 500 });
      }
      const enc = encryptSecret(body.apiKey);
      // 主页只存脱敏值
      (fields as Record<string, unknown>).apiKey = maskApiKey(body.apiKey);
      // 密文先暂存，等主页 upsert 完（保证 FK 目标存在）再写 secrets
      fields.updatedAt = new Date();
      await dbc
        .insert(apiConfigs)
        .values({
          id,
          name: fields.name ?? id,
          enabled: fields.enabled ?? false,
          ...fields,
        })
        .onConflictDoUpdate({
          target: apiConfigs.id,
          set: { ...fields, id },
        });
      // 再 upsert 密文到 secrets 表（set 用 excluded.column 引用新值）
      await dbc
        .insert(apiConfigSecrets)
        .values({
          configId: id,
          ciphertext: enc.ciphertext,
          iv: enc.iv,
          authTag: enc.authTag,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: apiConfigSecrets.configId,
          set: {
            ciphertext: sql`excluded.ciphertext`,
            iv: sql`excluded.iv`,
            authTag: sql`excluded.auth_tag`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    } else {
      fields.updatedAt = new Date();
      await dbc
        .insert(apiConfigs)
        .values({
          id,
          name: fields.name ?? id,
          enabled: fields.enabled ?? false,
          ...fields,
        })
        .onConflictDoUpdate({
          target: apiConfigs.id,
          set: { ...fields, id },
        });
    }

    return NextResponse.json({ requestId: reqId(), success: true, data: { id } });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `保存失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
