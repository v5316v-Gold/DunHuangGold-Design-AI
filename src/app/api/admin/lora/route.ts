/**
 * LoRA 上传 + 管理 API
 *
 * POST /api/admin/lora       - 创建 LoRA 记录
 * GET  /api/admin/lora       - 列出所有 LoRA
 * PATCH /api/admin/lora       - 启用/停用
 * DELETE /api/admin/lora      - 删除
 *
 * 简化版：元数据管理（不含文件上传逻辑）
 * 文件上传走单独的 /api/admin/lora/upload 端点
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { DrizzleLoraManager } from '@/lib/ai-gateway/adapters/lora-db';
import { unauthorized, badRequest } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}

/**
 * GET /api/admin/lora
 * 列出所有 LoRA
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();

  try {
    const mgr = new DrizzleLoraManager();
    const loras = await mgr.listAll();
    return NextResponse.json({
      success: true,
      count: loras.length,
      loras,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '查询失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/lora
 * 创建 LoRA 记录
 *
 * body: {
 *   name: string,
 *   description?: string,
 *   triggerWords: string[],
 *   filePath: string,           // 已上传的文件路径
 *   fileSize?: number,
 *   fileHash?: string,
 *   baseModel?: string,
 *   scope: string[],            // ['text2img', 'refine', ...]
 *   previewImage?: string,
 * }
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();

  try {
    const body = await request.json();
    const {
      name, description, triggerWords, filePath,
      fileSize, fileHash, baseModel, scope, previewImage,
    } = body;

    if (!name || !triggerWords || !filePath || !scope) {
      return badRequest('缺少必填字段: name / triggerWords / filePath / scope');
    }

    if (!Array.isArray(triggerWords) || !Array.isArray(scope)) {
      return badRequest('triggerWords / scope 必须是数组');
    }

    const mgr = new DrizzleLoraManager();
    const id = await mgr.create({
      name,
      description,
      triggerWords,
      filePath,
      fileSize,
      fileHash,
      baseModel,
      scope,
      previewImage,
      uploadedBy: admin.userId,
    });

    return NextResponse.json({
      success: true,
      id,
      message: 'LoRA 已创建',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '创建失败' },
      { status: 500 }
    );
  }
}