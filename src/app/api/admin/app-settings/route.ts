/**
 * /api/admin/app-settings
 * 管理员 · 助手全局设置（app_settings 表，单行 id='default'）
 *
 * GET - 返回 { translate_settings, interface_settings, system_settings,
 *          feature_switches, selected_services }（snake_case，前端 PromptConfigSection 约定）
 * PUT - 保存上述字段（仅更新 body 中出现的字段，其余保留）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { appSettings } from '@/db/schema/_tables';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

const ROW_ID = 'default';

/** 前端初始默认值（与 PromptConfigSection 的 useState 一致） */
const DEFAULTS = {
  translate_settings: {
    preserveNewline: true,
    removeRedundantDots: false,
    removeExtraSpaces: false,
    halfwidthPunctuation: false,
    mixedLangRule: 'to_en',
    useCache: true,
  },
  interface_settings: {
    iconOpacity: 20,
    imageCaptionLayout: 'h',
    promptLayout: 'right-center-v',
  },
  system_settings: {
    streaming: true,
    showStreamingProgress: false,
    imageCaptionCreationMode: 'auto',
    promptCreationMode: 'auto',
  },
  feature_switches: {
    nodeHelpTranslator: true,
    imageCaption: true,
    translate: true,
    expand: true,
    tag: true,
    history: true,
    enabled: true,
  },
  selected_services: {
    imageCaption: 'zhipu',
    expand: 'zhipu',
    translate: 'baidu',
  },
};

/** DB camelCase 行 → 前端 snake_case 输出 */
function toSnake(row: Record<string, unknown>) {
  return {
    translate_settings: row.translateSettings ?? DEFAULTS.translate_settings,
    interface_settings: row.interfaceSettings ?? DEFAULTS.interface_settings,
    system_settings: row.systemSettings ?? DEFAULTS.system_settings,
    feature_switches: row.featureSwitches ?? DEFAULTS.feature_switches,
    selected_services: row.selectedServices ?? DEFAULTS.selected_services,
  };
}

// ==================== GET ====================

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: true, data: DEFAULTS, warning: '数据库未配置' });
  }
  const dbc = db as NonNullable<typeof db>;

  try {
    const [row] = await dbc.select().from(appSettings).where(eq(appSettings.id, ROW_ID)).limit(1);
    if (!row) {
      return NextResponse.json({ requestId: reqId(), success: true, data: DEFAULTS });
    }
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: toSnake(row as unknown as Record<string, unknown>),
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: DEFAULTS,
      warning: `查询失败（app_settings 表可能不存在）: ${(err as Error).message}`,
    });
  }
}

// ==================== PUT（保存） ====================

interface SaveInput {
  translate_settings?: Record<string, unknown>;
  interface_settings?: Record<string, unknown>;
  system_settings?: Record<string, unknown>;
  feature_switches?: Record<string, unknown>;
  selected_services?: Record<string, unknown>;
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  let body: SaveInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const dbc = db as NonNullable<typeof db>;
  try {
    // 读取现有行（合并未提交的字段）
    const [existing] = await dbc
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, ROW_ID))
      .limit(1);

    const merged = {
      translateSettings: body.translate_settings ?? existing?.translateSettings ?? DEFAULTS.translate_settings,
      interfaceSettings: body.interface_settings ?? existing?.interfaceSettings ?? DEFAULTS.interface_settings,
      systemSettings: body.system_settings ?? existing?.systemSettings ?? DEFAULTS.system_settings,
      featureSwitches: body.feature_switches ?? existing?.featureSwitches ?? DEFAULTS.feature_switches,
      selectedServices: body.selected_services ?? existing?.selectedServices ?? DEFAULTS.selected_services,
    };

    await dbc
      .insert(appSettings)
      .values({ id: ROW_ID, ...merged, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { ...merged, updatedAt: new Date() },
      });

    return NextResponse.json({ requestId: reqId(), success: true, data: { id: ROW_ID } });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `保存失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
