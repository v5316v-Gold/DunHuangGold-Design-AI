/**
 * /api/admin/models/upload
 * 管理员 · 上传模型文件（multipart/form-data）
 *
 * 字段：file(必填) + modelType + name + version + description +
 *       triggerWords(逗号分隔) + boundFeatures(逗号分隔) + baseModel + weight
 *
 * 落盘：UPLOAD_DIR/models/（见 src/lib/storage-config.ts），自动计算 SHA256。
 * 响应：{ success, data: { id, filePath, originalFilename, fileSize, sha256 } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { models } from '@/db/schema/_tables';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { UPLOAD_DIR } from '@/lib/storage-config';
import { logAudit } from '@/lib/audit-logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

const MODEL_TYPES = ['lora', 'base-model', 'controlnet'];

/** 文件名安全化：去掉路径分隔符与危险字符 */
function safeFilename(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-]+/g, '_');
  return base || 'model.bin';
}

function splitList(s: string | null): string[] {
  if (!s) return [];
  return s
    .split(/[,，]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '不是合法的 multipart 请求' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少文件字段 file' }, { status: 400 });
  }

  const name = String(formData.get('name') || '').trim();
  if (!name) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少必填字段：name' }, { status: 400 });
  }

  const modelType = String(formData.get('modelType') || 'lora');
  if (!MODEL_TYPES.includes(modelType)) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `modelType 必须是 ${MODEL_TYPES.join(' / ')}`,
    }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash('sha256').update(bytes).digest('hex');

    // 落盘：UPLOAD_DIR/models/<timestamp>-<safe original name>
    const modelsDir = path.join(UPLOAD_DIR, 'models');
    await mkdir(modelsDir, { recursive: true });
    const savedFilename = `${Date.now()}-${safeFilename(file.name)}`;
    const filePath = path.join(modelsDir, savedFilename);
    await writeFile(filePath, bytes);

    const dbc = db as NonNullable<typeof db>;
    const [row] = await dbc
      .insert(models)
      .values({
        modelType,
        name,
        version: String(formData.get('version') || '1.0.0').trim() || '1.0.0',
        filePath,
        originalFilename: file.name,
        fileSize: bytes.length,
        sha256,
        description: String(formData.get('description') || '').trim() || null,
        triggerWords: splitList(String(formData.get('triggerWords') || '')),
        boundFeatures: splitList(String(formData.get('boundFeatures') || '')),
        baseModel: String(formData.get('baseModel') || '').trim() || null,
        weight: String(formData.get('weight') || '0.8').trim() || '0.8',
        uploadedBy: user.userId,
      })
      .returning({ id: models.id });

    await logAudit({
      action: 'model-upload',
      resourceType: 'model',
      resourceId: row?.id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      details: { modelType, name, fileSize: bytes.length, sha256 },
    });

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        id: row?.id,
        filePath,
        originalFilename: file.name,
        fileSize: bytes.length,
        sha256,
      },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `上传失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
