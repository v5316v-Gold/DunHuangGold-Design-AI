/**
 * 规则管理 API — Phase 5.1 迁移到 RulesRepository
 *
 * CRUD for prompt_rules table
 * @deprecated 此路由已废弃，90 天后将被删除（迁移到独立模块）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sanitizeError } from '@/lib/validators';
import { randomUUID } from 'crypto';
import { rulesRepository } from '@/db/repositories';

function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET — 列出规则 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const rules = await rulesRepository.list(category);

    return NextResponse.json(
      {
        requestId: reqId(),
        success: true,
        data: rules.map((r) => ({
          id: r.id,
          category: r.category,
          name: r.name,
          systemPrompt: r.systemPrompt,
          enabled: r.enabled,
          sortOrder: r.sortOrder,
        })),
      },
      { headers: { 'X-Deprecated-Source': 'admin/rules' } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { requestId: reqId(), success: false, error: sanitizeError(err, '获取规则失败').message },
      { status: 500 }
    );
  }
}

/** POST — 创建规则 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    const { id, category, name, systemPrompt, enabled = true, sortOrder = 0 } = await request.json();
    if (!id || !category || !name || !systemPrompt) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少必要参数' }, { status: 400 });
    }

    await rulesRepository.upsert({ id, category, name, systemPrompt, enabled, sortOrder });
    return NextResponse.json({ requestId: reqId(), success: true, message: '规则创建成功' });
  } catch (err: unknown) {
    return NextResponse.json(
      { requestId: reqId(), success: false, error: sanitizeError(err, '创建规则失败').message },
      { status: 500 }
    );
  }
}

/** PUT — 更新规则 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    const { id, name, systemPrompt, enabled, sortOrder } = await request.json();
    if (!id) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少规则ID' }, { status: 400 });
    }

    const existing = await rulesRepository.findById(id);
    if (!existing) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '规则不存在' }, { status: 404 });
    }

    await rulesRepository.upsert({
      id,
      category: existing.category,
      name: name ?? existing.name,
      systemPrompt: systemPrompt ?? existing.systemPrompt,
      enabled: enabled ?? existing.enabled,
      sortOrder: sortOrder ?? existing.sortOrder,
    });

    return NextResponse.json({ requestId: reqId(), success: true, message: '规则更新成功' });
  } catch (err: unknown) {
    return NextResponse.json(
      { requestId: reqId(), success: false, error: sanitizeError(err, '更新规则失败').message },
      { status: 500 }
    );
  }
}

/** DELETE — 删除规则 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少规则ID' }, { status: 400 });
    }

    await rulesRepository.delete(id);
    return NextResponse.json({ requestId: reqId(), success: true, message: '规则删除成功' });
  } catch (err: unknown) {
    return NextResponse.json(
      { requestId: reqId(), success: false, error: sanitizeError(err, '删除规则失败').message },
      { status: 500 }
    );
  }
}
