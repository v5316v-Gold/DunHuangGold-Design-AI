/**
 * POST /api/admin/comfyui/workflows/[id]/activate
 *
 * 8 项门禁全部 pass 后,创建 immutable workflow_version 并把 comfyui_configs.active_version_id 指向它。
 *
 * body: { changelog?: string, skipDryRun?: boolean, baseVersionId?: string }
 *
 * 行为:
 *   1) 读工作流体(workflowJson + mappings) → 构造新 version
 *   2) 跑 8 项门禁(默认包含 dry_run)
 *   3) 持久化 gate 结果
 *   4) 写 workflow_versions + 更新 comfyui_configs.active_version_id / lifecycle=active
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { comfyuiConfigs, comfyuiConnections } from '@/db/schema/_tables';
import { runGate, createWorkflowVersion, activateWorkflowVersion } from '@/lib/comfyui/workflow-gate';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId() {
  return `req_${randomUUID()}`;
}

/** 直接复用 workflow-gate.activateWorkflowVersion 的等价写法——但顺便回写一些 comfyui_configs 字段 */
async function writeComfyuiConfigsActive(dbc: NonNullable<typeof db>, workflowId: string, versionId: string) {
  await dbc.execute(sql`
    UPDATE comfyui_configs
       SET active_version_id = ${versionId},
           lifecycle = 'active',
           enabled = true,
           last_validation_at = NOW(),
           dependency_status = 'resolved'
     WHERE id = ${workflowId}
  `);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库不可用' }, { status: 503 });
  }
  const { id } = await params;
  const dbc = db as NonNullable<typeof db>;

  // 1. body
  let body: { changelog?: string; skipDryRun?: boolean; baseVersionId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  // 2. 工作流体
  const [wf] = await dbc.select().from(comfyuiConfigs).where(eq(comfyuiConfigs.id, id)).limit(1);
  if (!wf) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '工作流不存在' }, { status: 404 });
  }
  const workflowJson = (wf.workflowJson as Record<string, unknown>) ?? {};
  const inputMapping = (wf.nodeMapping as Record<string, unknown>) ?? {};
  const outputMapping = (wf.defaultParams as Record<string, unknown>) ?? {};
  const nodeMapping = (wf.nodeMapping as Record<string, unknown>) ?? {};
  const defaultParams = (wf.defaultParams as Record<string, unknown>) ?? {};
  const fixedParams = (wf.fixedParams as Record<string, unknown>) ?? {};

  if (!workflowJson || Object.keys(workflowJson).length === 0) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '工作流尚未上传 workflowJson' }, { status: 400 });
  }

  // 3. connection
  let connHost = process.env.COMFYUI_HOST || 'http://localhost:8188';
  if (wf.connectionId) {
    const [c] = await dbc.select().from(comfyuiConnections).where(eq(comfyuiConnections.id, wf.connectionId)).limit(1);
    if (c) connHost = `http://${c.host}:${c.port}`;
  }

  try {
    // 4. 创建新 version（不可变）
    const versionId = await createWorkflowVersion({
      workflowId: id,
      workflowJson,
      inputMapping,
      outputMapping,
      nodeMapping,
      defaultParams,
      fixedParams,
      changelog: body.changelog,
      createdBy: user.userId,
    });

    // 5. 跑 8 项门禁 + 升级 active
    const result = await activateWorkflowVersion({
      workflowId: id,
      workflowVersionId: versionId,
      featureId: wf.featureId,
      connectionHost: connHost,
    });

    if (!result.success) {
      return NextResponse.json({
        requestId: reqId(),
        success: false,
        error: '8 项门禁未全部通过,未激活',
        data: { versionId, blockers: result.gateReport.blockers, gateReport: result.gateReport },
      }, { status: 422 });
    }

    // 6. 写 comfyui_configs
    await writeComfyuiConfigsActive(dbc, id, versionId);

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        versionId,
        workflowId: id,
        featureId: wf.featureId,
        gateReport: result.gateReport,
        checksum: createHash('sha256').update(JSON.stringify(workflowJson)).digest('hex'),
      },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `激活失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
