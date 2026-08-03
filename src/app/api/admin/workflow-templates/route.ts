/**
 * GET /api/admin/workflow-templates
 *
 * 列出所有工作流模板（按 service_type 分组）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/storage/database/db';
import { eq, desc } from 'drizzle-orm';
import { WorkflowManager } from '@/lib/ai-gateway/adapters/workflow-manager';
import { requireAuth } from '@/lib/auth';
import { unauthorized } from '@/lib/api-response';
import { pgTable, uuid, varchar, integer, jsonb, boolean, text, timestamp } from 'drizzle-orm/pg-core';
import type { AIServiceType } from '@/lib/ai-service/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 管理员鉴权（role === 'admin'）
 * 内联实现，避免新增 auth.ts 接口
 */
async function requireAdmin(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return null;
  if (user.role !== 'admin') return null;
  return user;
}

const workflowTemplates = pgTable('workflow_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  serviceType: varchar('service_type', { length: 30 }).notNull(),
  version: integer('version').default(1).notNull(),
  workflowJson: jsonb('workflow_json').notNull(),
  inputSchema: jsonb('input_schema'),
  comfyuiVersion: varchar('comfyui_version', { length: 20 }),
  requiredCustomNodes: jsonb('required_custom_nodes').$type<string[]>().default([]),
  enabled: boolean('enabled').default(true).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get('service') as AIServiceType | null;

    if (!db) {
      return NextResponse.json({ error: 'DB 不可用' }, { status: 503 });
    }

    if (serviceType) {
      // 单服务列表
      const rows = await db
        .select()
        .from(workflowTemplates)
        .where(eq(workflowTemplates.serviceType, serviceType))
        .orderBy(desc(workflowTemplates.version));

      return NextResponse.json({
        success: true,
        serviceType,
        count: rows.length,
        templates: rows.map((r) => ({
          id: r.id,
          name: r.name,
          version: r.version,
          enabled: r.enabled,
          comfyuiVersion: r.comfyuiVersion,
          description: r.description,
          createdAt: r.createdAt,
        })),
      });
    }

    // 全量
    const wm = new WorkflowManager();
    const enabled = await wm.listEnabled();

    return NextResponse.json({
      success: true,
      count: enabled.length,
      templates: enabled.map((w) => ({
        id: w.id,
        name: w.name,
        serviceType: w.serviceType,
        version: w.version,
        enabled: w.enabled,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '查询失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/workflow-templates
 *
 * 创建工作流模板
 *
 * body: {
 *   name: string,
 *   serviceType: AIServiceType,
 *   workflowJson: object,
 *   version?: number,
 *   comfyuiVersion?: string,
 *   description?: string
 * }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();

  try {
    if (!db) {
      return NextResponse.json({ error: 'DB 不可用' }, { status: 503 });
    }

    const body = await request.json();
    const { name, serviceType, workflowJson, version = 1, comfyuiVersion, description } = body;

    if (!name || !serviceType || !workflowJson) {
      return NextResponse.json(
        { error: '缺少必填字段: name / serviceType / workflowJson' },
        { status: 400 }
      );
    }

    const [created] = await db.insert(workflowTemplates).values({
      name,
      serviceType,
      version,
      workflowJson,
      comfyuiVersion,
      description,
      enabled: true,
    }).returning();

    return NextResponse.json({
      success: true,
      template: created,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '创建失败' },
      { status: 500 }
    );
  }
}