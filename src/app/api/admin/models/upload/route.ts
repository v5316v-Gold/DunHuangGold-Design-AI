/**
 * 模型文件上传 API（任务三）
 *
 * POST /api/admin/models/upload （multipart/form-data）
 *
 * 表单字段：
 *   file           File       模型文件（必填）
 *   modelType      string     lora / base-model / controlnet（必填）
 *   name           string     模型名称（必填）
 *   version        string     版本，默认 1.0.0
 *   description    string     描述（可选）
 *   baseModel      string     基础模型（可选）
 *   weight         string     权重 0-1（可选，默认 0.8）
 *   triggerWords   string     触发词，逗号分隔（可选）
 *   boundFeatures  string     绑定功能 featureCode，逗号分隔（可选）
 *
 * 处理流程：
 *   1. requireAdmin
 *   2. 流式计算 SHA256（crypto.createHash('sha256')，边读边写边哈希，避免大模型全量载入内存）
 *   3. 落盘到 process.env.MODELS_DIR || './models' 下的子目录（loras / base-models / controlnets）
 *   4. 文件命名 {sanitizedName}-{sha256前8位}.{ext}
 *   5. 插入 models 表元数据（含 sha256/fileSize/filePath）
 *   6. logAudit(action: 'models.upload')
 */

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { createWriteStream } from 'fs';
import { mkdir, rename, rm } from 'fs/promises';
import { extname, join } from 'path';

import { db } from '@/db';
import { models } from '@/db/schema/_tables';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit-logger';
import { apiSuccess, badRequest, internalError, unauthorized } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL_TYPES = ['lora', 'base-model', 'controlnet'] as const;

// 类型 -> 落盘子目录
const TYPE_DIRS: Record<string, string> = {
  lora: 'loras',
  'base-model': 'base-models',
  controlnet: 'controlnets',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB 安全上限

/** 文件名清洗：仅保留字母数字 . _ - */
function sanitizeName(name: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return cleaned || 'model';
}

async function requireAdmin(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return null;
  if (user.role !== 'admin' && user.role !== 'superadmin') return null;
  return user;
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();
  if (!db) return internalError(new Error('数据库未配置'));

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error('[models/upload] 解析表单失败:', err);
    return badRequest('请求格式错误：需要 multipart/form-data');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return badRequest('缺少文件字段 file');
  }
  if (file.size <= 0) {
    return badRequest('文件为空');
  }
  if (file.size > MAX_FILE_SIZE) {
    return badRequest('文件超过大小上限（10GB）');
  }

  const modelType = String(formData.get('modelType') || '');
  if (!(MODEL_TYPES as readonly string[]).includes(modelType)) {
    return badRequest('modelType 必须是 lora / base-model / controlnet');
  }
  const name = String(formData.get('name') || '').trim();
  if (!name) {
    return badRequest('缺少必填字段: name');
  }
  const version = String(formData.get('version') || '1.0.0').trim() || '1.0.0';
  const description = String(formData.get('description') || '').trim() || null;
  const baseModel = String(formData.get('baseModel') || '').trim() || null;
  const weightRaw = String(formData.get('weight') || '').trim();
  const weight = weightRaw || '0.8';
  const triggerWords = String(formData.get('triggerWords') || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const boundFeatures = String(formData.get('boundFeatures') || '')
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 落盘目录：process.env.MODELS_DIR || './models'，按类型分子目录
  const root = process.env.MODELS_DIR || './models';
  const dir = join(root, TYPE_DIRS[modelType] || modelType);
  const ext = extname(file.name).toLowerCase() || '.bin';
  const base = sanitizeName(name);

  let tempPath = '';
  let finalPath = '';

  try {
    await mkdir(dir, { recursive: true });

    // 先写临时文件（边写边流式计算 SHA256），完成后重命名为最终文件名
    tempPath = join(dir, `.${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    const hash = createHash('sha256');
    const writeStream = createWriteStream(tempPath);
    const reader = file.stream().getReader();
    let size = 0;

    await new Promise<void>((resolve, reject) => {
      writeStream.on('error', reject);
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const buf = Buffer.from(value as Uint8Array);
            hash.update(buf);
            size += buf.length;
            if (!writeStream.write(buf)) {
              await new Promise<void>((drainResolve) => writeStream.once('drain', drainResolve));
            }
          }
          writeStream.end(() => resolve());
        } catch (err) {
          writeStream.destroy();
          reject(err);
        }
      })();
    });

    const sha256 = hash.digest('hex');
    // 文件命名：{sanitizedName}-{sha256前8位}.{ext}
    finalPath = join(dir, `${base}-${sha256.slice(0, 8)}${ext}`);
    await rename(tempPath, finalPath);

    // 插入 models 表元数据
    const [row] = await db
      .insert(models)
      .values({
        modelType,
        name,
        version,
        filePath: finalPath,
        originalFilename: file.name,
        fileSize: size,
        sha256,
        boundFeatures,
        enabled: true,
        triggerWords,
        baseModel,
        weight,
        description,
        uploadedBy: admin.userId,
      })
      .returning();

    await logAudit({
      action: 'models.upload',
      resourceType: 'model',
      resourceId: row.id,
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      details: { name, modelType, filePath: finalPath, fileSize: size, sha256 },
    });

    return apiSuccess({ model: row }, { message: '模型上传成功' });
  } catch (err) {
    console.error('[models/upload] 上传失败:', err);
    // 清理可能残留的临时/半成品文件
    for (const p of [tempPath, finalPath]) {
      if (p) {
        try {
          await rm(p, { force: true });
        } catch {
          // 忽略清理失败
        }
      }
    }
    return internalError(err, '模型上传失败');
  }
}
