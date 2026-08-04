/**
 * 功能算力配置 API
 * GET: 获取所有功能算力配置
 * PUT: 更新功能算力配置
 */
/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到 /api/admin/settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const dynamic = 'force-dynamic';

// 默认功能算力配置
const DEFAULT_FEATURE_COSTS: Record<string, { name: string; cost: number }> = {
  dialogue: { name: 'AI对话', cost: 2 },
  text2img: { name: '文案生图', cost: 15 },
  refine: { name: '产品精修', cost: 20 },
  blend: { name: '多图融合', cost: 15 },
  oneclick: { name: '一键设计', cost: 15 },
  multiview: { name: '生成多视图', cost: 20 },
  sketch: { name: '线稿/写实', cost: 15 },
  free: { name: '自由创作', cost: 15 },
  relief: { name: '浮雕设计', cost: 20 },
  image3d: { name: '图转3D', cost: 30 },
  removebg: { name: '移除背景', cost: 5 },
  upscale: { name: '高清放大', cost: 5 },
  watermark: { name: '去除水印', cost: 5 },
  text2video: { name: '文生视频', cost: 50 },
  img2video: { name: '图生视频', cost: 40 },
  '2dto3d': { name: '平面转雕塑', cost: 25 },
  tryon: { name: '试戴效果', cost: 25 },
};

const SETTINGS_KEY = 'feature-costs';

/**
 * 获取功能算力配置
 * GET /api/admin/feature-costs
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
    }

    if (!db) {
      // 开发模式返回默认配置
      const costs = Object.entries(DEFAULT_FEATURE_COSTS).map(([key, val]) => ({
        feature: key,
        name: val.name,
        cost: val.cost,
      }));
      return NextResponse.json({ requestId: reqId(), success: true, data: { features: costs } });
    }

    // 从数据库加载配置
    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, SETTINGS_KEY))
      .limit(1);

    let featureCosts = { ...DEFAULT_FEATURE_COSTS };

    if (rows.length > 0 && rows[0].value) {
      try {
        const stored = typeof rows[0].value === 'string'
          ? JSON.parse(rows[0].value)
          : rows[0].value;
        // 合并默认配置和存储的配置
        featureCosts = { ...DEFAULT_FEATURE_COSTS, ...stored };
      } catch (e) {
        console.error('[feature-costs] 解析配置失败:', e);
      }
    }

    // 转换为数组格式
    const costs = Object.entries(featureCosts).map(([feature, val]) => ({
      feature,
      name: typeof val === 'object' ? val.name : (DEFAULT_FEATURE_COSTS[feature]?.name || feature),
      cost: typeof val === 'object' ? val.cost : parseInt(String(val)) || DEFAULT_FEATURE_COSTS[feature]?.cost || 10,
    }));

    return NextResponse.json({ requestId: reqId(), success: true, data: { features: costs } });

  } catch (error) {
    console.error('[admin/feature-costs] GET 失败:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '获取失败' }, { status: 500 });
  }
}

/**
 * 更新功能算力配置
 * PUT /api/admin/feature-costs
 * Body: { features: { [feature: string]: number } }
 */
export async function PUT(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
    }

    const body = await request.json();
    const { features } = body;

    if (!features || typeof features !== 'object') {
      return NextResponse.json({ requestId: reqId(), success: false, error: '参数错误' }, { status: 400 });
    }

    // 验证和格式化配置
    const newCosts: Record<string, { name: string; cost: number }> = {};
    for (const [key, val] of Object.entries(features)) {
      const cost = parseInt(String(val));
      if (isNaN(cost) || cost < 0) {
        return NextResponse.json({ requestId: reqId(), success: false, error: `功能 ${key} 算力值无效` }, { status: 400 });
      }
      newCosts[key] = {
        name: DEFAULT_FEATURE_COSTS[key]?.name || key,
        cost,
      };
    }

    // 保存到数据库
    if (db) {
      const existing = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, SETTINGS_KEY))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(systemSettings)
          .set({ value: JSON.stringify(newCosts) })
          .where(eq(systemSettings.key, SETTINGS_KEY));
      } else {
        await db.insert(systemSettings).values({
          key: SETTINGS_KEY,
          value: JSON.stringify(newCosts),
        });
      }
    }

    return NextResponse.json({ requestId: reqId(), success: true, data: { features: Object.entries(newCosts).map(([f, v]) => ({ feature: f, ...v })) } });

  } catch (error) {
    console.error('[admin/feature-costs] PUT 失败:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '保存失败' }, { status: 500 });
  }
}
