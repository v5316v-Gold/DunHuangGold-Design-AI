/**
 * 规则管理 API
 * CRUD operations for prompt_rules table
 */
/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 独立保留（无合并目标）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { promptRules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sanitizeError } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 获取所有规则
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!db) {
      // console.error('[rules] 数据库未连接');
      return NextResponse.json({ success: false, error: '数据库未连接' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = db.select().from(promptRules).orderBy(promptRules.sortOrder);
    
    if (category) {
      query = query.where(eq(promptRules.category, category)) as any;
    }

    const rules = await query;

    return NextResponse.json({
      success: true,
      data: rules.map(rule => ({
        id: rule.id,
        category: rule.category,
        name: rule.name,
        systemPrompt: rule.systemPrompt,
        enabled: rule.enabled,
        sortOrder: rule.sortOrder,
      })),
    }, { headers: { 'X-Deprecated-Source': 'admin/rules' } });

  } catch (err: unknown) {
    // console.error('[rules] 获取规则失败:', error);
    return NextResponse.json({
      success: false,
      error: sanitizeError(err, '获取规则失败').message,
    }, { status: 500 });
  }
}

// 创建规则
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!db) {
      // console.error('[rules] 数据库未连接');
      return NextResponse.json({ success: false, error: '数据库未连接' }, { status: 500 });
    }
    
    const { id, category, name, systemPrompt, enabled = true, sortOrder = 0 } = await request.json();

    if (!id || !category || !name || !systemPrompt) {
      return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
    }

    await db.insert(promptRules).values({
      id,
      category,
      name,
      systemPrompt,
      enabled,
      sortOrder,
    });

    return NextResponse.json({ success: true, message: '规则创建成功' });

  } catch (err: unknown) {
    // console.error('[rules] 创建规则失败:', error);
    return NextResponse.json({
      success: false,
      error: sanitizeError(err, '创建规则失败').message,
    }, { status: 500 });
  }
}

// 更新规则
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!db) {
      // console.error('[rules] 数据库未连接');
      return NextResponse.json({ success: false, error: '数据库未连接' }, { status: 500 });
    }
    
    const { id, name, systemPrompt, enabled, sortOrder } = await request.json();

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少规则ID' }, { status: 400 });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
    if (enabled !== undefined) updates.enabled = enabled;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    updates.updatedAt = new Date();

    await db.update(promptRules).set(updates).where(eq(promptRules.id, id));

    return NextResponse.json({ success: true, message: '规则更新成功' });

  } catch (err: unknown) {
    // console.error('[rules] 更新规则失败:', error);
    return NextResponse.json({
      success: false,
      error: sanitizeError(err, '更新规则失败').message,
    }, { status: 500 });
  }
}

// 删除规则
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    if (!db) {
      // console.error('[rules] 数据库未连接');
      return NextResponse.json({ success: false, error: '数据库未连接' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: '缺少规则ID' }, { status: 400 });
    }

    await db.delete(promptRules).where(eq(promptRules.id, id));

    return NextResponse.json({ success: true, message: '规则删除成功' });

  } catch (err: unknown) {
    // console.error('[rules] 删除规则失败:', error);
    return NextResponse.json({
      success: false,
      error: sanitizeError(err, '删除规则失败').message,
    }, { status: 500 });
  }
}
