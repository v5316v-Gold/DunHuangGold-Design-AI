/**
 * GET /api/admin/alerts
 * W3 · 后台告警聚合
 *
 * 数据源:
 *  - audit_logs(权限/auth/admin 操作)
 *  - tasks(status IN failed/dead_letter)
 *  - comfyui_execution_logs(status = failed)
 *
 * 期间默认 24h,可由 ?sinceHours=24 调整;limit 默认 50。
 *
 * 响应结构:
 * {
 *   summary: {
 *     severity: { critical | warn | info } counts,
 *     failedTasks: number,
 *     deadLetterTasks: number,
 *     comfyuiErrors: number,
 *     auditErrors: number
 *   },
 *   groups: [
 *     { id, severity, title, count, lastAt, sample }
 *   ],
 *   recent: [原始 entries 排序后]
 * }
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getCurrentUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId() {
  return `req_${randomUUID()}`;
}

interface AlertEntry {
  id: string;
  severity: 'critical' | 'warn' | 'info';
  source: 'task' | 'audit' | 'comfyui' | 'worker';
  title: string;
  detail: string;
  meta: Record<string, unknown>;
  at: string;
}

function severityOf(source: AlertEntry['source'], status: string | null): AlertEntry['severity'] {
  if (source === 'task' && status === 'dead_letter') return 'critical';
  if (source === 'task' && status === 'failed') return 'warn';
  if (source === 'comfyui') return 'warn';
  if (source === 'worker') return 'warn';
  return 'info';
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: true, data: { summary: {}, groups: [], recent: [] }, warning: 'DB 不可用' });
  }

  const url = new URL(request.url);
  const sinceHours = Math.max(1, Math.min(168, parseInt(url.searchParams.get('sinceHours') || '24', 10)));
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

  const sinceAt = sql`NOW() - (${sinceHours} || ' hours')::interval`;

  // 1) failed / dead_letter 任务
  const failedRows = await db.execute<{
    id: string; user_id: string; feature_code: string | null; status: string; error: string | null; updated_at: string;
  }>(sql`
    SELECT id, user_id, feature_code, status, error, updated_at
    FROM tasks
    WHERE status IN ('failed','dead_letter')
      AND updated_at > ${sinceAt}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `);

  // 2) ComfyUI 失败执行
  const comfyFailed = await db.execute<{
    id: number; workflow_id: string; feature_id: string; error_message: string | null; created_at: string;
  }>(sql`
    SELECT id, workflow_id, feature_id, error_message, created_at
    FROM comfyui_execution_logs
    WHERE status = 'failed'
      AND created_at > ${sinceAt}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  // 3) Audit 异常动作(resourceType in auth/admin/system,payload 视情况)
  const auditRows = await db.execute<{
    id: string; actor_email: string | null; action: string; resource_type: string; resource_id: string | null; created_at: string;
  }>(sql`
    SELECT id, actor_email, action, resource_type, resource_id, created_at
    FROM audit_logs
    WHERE resource_type IN ('auth','admin','system','comfyui-config')
      AND created_at > ${sinceAt}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  const entries: AlertEntry[] = [];

  for (const r of failedRows.rows ?? []) {
    entries.push({
      id: `task:${r.id}`,
      severity: severityOf('task', r.status),
      source: 'task',
      title: `任务 ${r.status === 'dead_letter' ? '进入死信' : '失败'}: ${r.feature_code ?? 'unknown'}`,
      detail: (r.error ?? '').slice(0, 200),
      meta: { taskId: r.id, userId: r.user_id, featureCode: r.feature_code, status: r.status },
      at: r.updated_at,
    });
  }

  for (const r of comfyFailed.rows ?? []) {
    entries.push({
      id: `comfyui:${r.id}`,
      severity: 'warn',
      source: 'comfyui',
      title: `ComfyUI workflow 失败: ${r.workflow_id}`,
      detail: (r.error_message ?? '').slice(0, 200),
      meta: { workflowId: r.workflow_id, featureId: r.feature_id },
      at: r.created_at,
    });
  }

  for (const r of auditRows.rows ?? []) {
    entries.push({
      id: `audit:${r.id}`,
      severity: 'info',
      source: 'audit',
      title: `${r.action} ${r.resource_type}`,
      detail: r.resource_id ?? '',
      meta: { actor: r.actor_email ?? 'unknown' },
      at: r.created_at,
    });
  }

  entries.sort((a, b) => (a.at < b.at ? 1 : -1));
  const recent = entries.slice(0, limit);

  // summary
  const summary = {
    critical: entries.filter((e) => e.severity === 'critical').length,
    warn: entries.filter((e) => e.severity === 'warn').length,
    info: entries.filter((e) => e.severity === 'info').length,
    failedTasks: (failedRows.rows ?? []).filter((r) => r.status === 'failed').length,
    deadLetterTasks: (failedRows.rows ?? []).filter((r) => r.status === 'dead_letter').length,
    comfyuiErrors: (comfyFailed.rows ?? []).length,
    auditEvents: (auditRows.rows ?? []).length,
  };

  // groups:按 title 去重聚合
  const groupMap = new Map<string, { severity: AlertEntry['severity']; title: string; count: number; lastAt: string; sample?: string }>();
  for (const e of entries) {
    const key = `${e.source}::${e.title}`;
    const g = groupMap.get(key);
    if (g) {
      g.count += 1;
      if (e.at > g.lastAt) g.lastAt = e.at;
    } else {
      groupMap.set(key, { severity: e.severity, title: e.title, count: 1, lastAt: e.at, sample: e.detail });
    }
  }
  const groups = [...groupMap.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));

  return NextResponse.json({
    requestId: reqId(),
    success: true,
    data: {
      summary,
      groups,
      recent,
      generatedAt: new Date().toISOString(),
      windowHours: sinceHours,
    },
  });
}
