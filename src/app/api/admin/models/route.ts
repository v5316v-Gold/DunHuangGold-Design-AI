/**
 * 模型中心 API（任务三）
 *
 * GET    /api/admin/models?type=&enabled=&page=&pageSize=  列表（分页 + 过滤）
 * POST   /api/admin/models                                   登记模型（元数据）
 * PATCH  /api/admin/models                                   更新（enabled/name/weight/boundFeatures 等）
 * DELETE /api/admin/models?id=&deleteFile=                   删除（元数据删除 + 可选删除文件）
 *
 * 所有操作 requireAdmin（admin / superadmin）+ logAudit。
 * 兼容旧版：带 action 参数（GET/POST）或 provider 参数（DELETE）时，
 * 分发到 ./legacy 的 AI 助手模型列表逻辑，避免破坏历史调用方。
 */

import { NextRequest } from 'next/server';
import { and, count, desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { models } from '@/db/schema/_tables';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit-logger';
import {
  apiSuccess,
  badRequest,
  internalError,
  notFound,
  unauthorized,
} from '@/lib/api-response';
import { rm } from 'fs/promises';
import { legacyDELETE, legacyGET, legacyPOST } from './legacy';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL_TYPES = ['lora', 'base-model', 'controlnet'] as const;
type ModelType = (typeof MODEL_TYPES)[number];

function isModelType(value: unknown): value is ModelType {
  return typeof value === 'string' && (MODEL_TYPES as readonly string[]).includes(value);
}

async function requireAdmin(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return null;
  if (user.role !== 'admin' && user.role !== 'superadmin') return null;
  return user;
}

/**
 * GET /api/admin/models
 * 模型列表（分页 + 类型/启用状态过滤）
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // 兼容旧版：AI 助手模型列表（action 参数分发）
  const action = searchParams.get('action');
  if (action === 'detect-provider' || action === 'get-saved-models' || action === 'get-models') {
    return legacyGET(request);
  }

  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();
  if (!db) return internalError(new Error('数据库未配置'));

  try {
    const type = searchParams.get('type') || undefined;
    const enabledRaw = searchParams.get('enabled');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20)
    );

    const conditions = [];
    if (type && isModelType(type)) {
      conditions.push(eq(models.modelType, type));
    }
    if (enabledRaw === 'true' || enabledRaw === 'false') {
      conditions.push(eq(models.enabled, enabledRaw === 'true'));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(models)
      .where(where);

    const items = await db
      .select()
      .from(models)
      .where(where)
      .orderBy(desc(models.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return apiSuccess({ items, total, page, pageSize });
  } catch (err) {
    console.error('[models] 查询失败:', err);
    return internalError(err, '查询模型失败');
  }
}

/**
 * POST /api/admin/models
 * 登记模型（元数据，无文件）
 *
 * body: {
 *   modelType: 'lora' | 'base-model' | 'controlnet',
 *   name: string,
 *   version?: string,
 *   filePath?: string,        // 已存在文件的路径（可选）
 *   description?: string,
 *   boundFeatures?: string[],
 *   triggerWords?: string[],
 *   baseModel?: string,
 *   weight?: number | string, // 0-1
 * }
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // 兼容旧版：AI 助手模型列表操作（action 字段分发）
  if (typeof body.action === 'string' && body.action) {
    return legacyPOST(body);
  }

  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();
  if (!db) return internalError(new Error('数据库未配置'));

  try {
    const {
      modelType, name, version, filePath, description,
      boundFeatures, triggerWords, baseModel, weight, sha256, fileSize,
    } = body;

    if (!isModelType(modelType)) {
      return badRequest('modelType 必须是 lora / base-model / controlnet');
    }
    if (typeof name !== 'string' || !name.trim()) {
      return badRequest('缺少必填字段: name');
    }

    const [row] = await db
      .insert(models)
      .values({
        modelType,
        name: name.trim(),
        version: typeof version === 'string' && version ? version : '1.0.0',
        filePath: typeof filePath === 'string' && filePath ? filePath : null,
        description: typeof description === 'string' && description ? description : null,
        boundFeatures: Array.isArray(boundFeatures) ? boundFeatures : [],
        triggerWords: Array.isArray(triggerWords) ? triggerWords : [],
        baseModel: typeof baseModel === 'string' && baseModel ? baseModel : null,
        weight: weight !== undefined && weight !== null && weight !== '' ? String(weight) : '0.8',
        sha256: typeof sha256 === 'string' && sha256 ? sha256 : null,
        fileSize: typeof fileSize === 'number' ? fileSize : 0,
        uploadedBy: admin.userId,
      })
      .returning();

    await logAudit({
      action: 'models.create',
      resourceType: 'model',
      resourceId: row.id,
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      details: { name: row.name, modelType: row.modelType, filePath: row.filePath },
    });

    return apiSuccess(row, { message: '模型已登记' });
  } catch (err) {
    console.error('[models] 登记失败:', err);
    return internalError(err, '登记模型失败');
  }
}

/**
 * PATCH /api/admin/models
 * 更新模型（enabled/name/version/weight/boundFeatures/triggerWords 等）
 *
 * body: { id: string, ...待更新字段 }
 */
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();
  if (!db) return internalError(new Error('数据库未配置'));

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || '');
    if (!id) return badRequest('缺少 id');

    const changes: Partial<typeof models.$inferInsert> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return badRequest('name 不能为空');
      }
      changes.name = body.name.trim();
    }
    if (body.version !== undefined) {
      changes.version = body.version === null || body.version === '' ? '1.0.0' : String(body.version);
    }
    if (body.modelType !== undefined) {
      if (!isModelType(body.modelType)) return badRequest('modelType 非法');
      changes.modelType = body.modelType;
    }
    if (body.filePath !== undefined) {
      changes.filePath = body.filePath === null || body.filePath === '' ? null : String(body.filePath);
    }
    if (body.description !== undefined) {
      changes.description = body.description === null ? null : String(body.description);
    }
    if (body.baseModel !== undefined) {
      changes.baseModel = body.baseModel === null || body.baseModel === '' ? null : String(body.baseModel);
    }
    if (body.enabled !== undefined) {
      changes.enabled = Boolean(body.enabled);
    }
    if (body.weight !== undefined) {
      changes.weight = body.weight === null || body.weight === '' ? null : String(body.weight);
    }
    if (body.boundFeatures !== undefined) {
      changes.boundFeatures = Array.isArray(body.boundFeatures) ? body.boundFeatures : [];
    }
    if (body.triggerWords !== undefined) {
      changes.triggerWords = Array.isArray(body.triggerWords) ? body.triggerWords : [];
    }

    if (Object.keys(changes).length === 0) {
      return badRequest('没有可更新的字段');
    }
    changes.updatedAt = new Date();

    const [row] = await db
      .update(models)
      .set(changes)
      .where(eq(models.id, id))
      .returning();

    if (!row) return notFound('模型不存在');

    await logAudit({
      action: 'models.update',
      resourceType: 'model',
      resourceId: id,
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      details: { ...changes, updatedAt: undefined },
    });

    return apiSuccess(row, { message: '模型已更新' });
  } catch (err) {
    console.error('[models] 更新失败:', err);
    return internalError(err, '更新模型失败');
  }
}

/**
 * DELETE /api/admin/models
 * 删除模型（元数据删除 + deleteFile=true 时删除落盘文件）
 *
 * 支持 ?id=xxx（查询参数）或 body { id, deleteFile }
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // 兼容旧版：清空供应商模型列表（provider 参数分发）
  const provider = searchParams.get('provider');
  if (provider) {
    return legacyDELETE(provider);
  }

  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();
  if (!db) return internalError(new Error('数据库未配置'));

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || searchParams.get('id') || '');
    if (!id) return badRequest('缺少 id');
    const deleteFile = body?.deleteFile === true || searchParams.get('deleteFile') === 'true';

    const [existing] = await db
      .select()
      .from(models)
      .where(eq(models.id, id))
      .limit(1);
    if (!existing) return notFound('模型不存在');

    await db.delete(models).where(eq(models.id, id));

    if (deleteFile && existing.filePath) {
      try {
        await rm(existing.filePath, { force: true });
      } catch (fileErr) {
        console.warn('[models] 文件删除失败（不影响元数据删除）:', fileErr);
      }
    }

    await logAudit({
      action: 'models.delete',
      resourceType: 'model',
      resourceId: id,
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      details: { name: existing.name, modelType: existing.modelType, filePath: existing.filePath, deleteFile },
    });

    return apiSuccess({ id, deleted: true }, { message: '模型已删除' });
  } catch (err) {
    console.error('[models] 删除失败:', err);
    return internalError(err, '删除模型失败');
  }
}
