/**
 * POST /api/admin/comfyui/workflows/[id]/validate
 *
 * 8 项发布门禁全套跑一遍(只校验、不激活)。返回 GateReport。
 *
 * body: { skipDryRun?: boolean }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { comfyuiConfigs, comfyuiConnections } from '@/db/schema/_tables';
import { runGate } from '@/lib/comfyui/workflow-gate';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId() {
  return `req_${randomUUID()}`;
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

  // 1. 取 workflow + version
  const [wf] = await dbc.select().from(comfyuiConfigs).where(eq(comfyuiConfigs.id, id)).limit(1);
  if (!wf) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '工作流不存在' }, { status: 404 });
  }

  // 2. 取 connection
  let connHost: string | null = null;
  if (wf.connectionId) {
    const [c] = await dbc.select().from(comfyuiConnections).where(eq(comfyuiConnections.id, wf.connectionId)).limit(1);
    if (c) connHost = `http://${c.host}:${c.port}`;
  }
  // 没 connection 或 host 不可达: fallback localhost
  if (!connHost) connHost = process.env.COMFYUI_HOST || 'http://localhost:8188';

  // 3. 取 workflow_json + input/output mapping(优先 active version,然后 workflow 本体)
  const workflowJson = (wf.workflowJson as Record<string, unknown>) ?? {};
  const inputMapping = (wf.nodeMapping as Record<string, unknown>) ?? {};
  const outputMapping = (wf.defaultParams as Record<string, unknown>) ?? {};

  if (!workflowJson || Object.keys(workflowJson).length === 0) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '该工作流尚未上传 workflowJson' }, { status: 400 });
  }

  // 4. body: skipDryRun 可选
  const body = (await request.json().catch(() => ({}))) as { skipDryRun?: boolean };

  try {
    // 复用 v2 接口的临时 report:这里不落库,只报告
    const report = await runGate({
      workflowId: id,
      workflowVersionId: `${id}__preview`,
      workflowJson,
      inputMapping,
      outputMapping,
      featureId: wf.featureId,
      connectionHost: connHost,
      skipDryRun: body.skipDryRun,
    });

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        workflowId: id,
        featureId: wf.featureId,
        overallPass: report.overallPass,
        blockers: report.blockers,
        items: report.items,
      },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `门禁执行失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
