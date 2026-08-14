/**
 * Phase 9.23 §6 · Custom Node 依赖检查
 *
 * 通过 ComfyUI /object_info 或等价能力读取当前 Runtime 支持的 class_type，
 * 与 Workflow 中使用的节点进行比对。
 *
 * 约束（docs §15）：
 *  - 缺失节点标记 missing custom node
 *  - 第一阶段禁止自动 git clone 或自动安装未知节点
 *  - 后台仅显示缺失项 + 重新扫描操作
 */
import { createHash } from 'crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/storage/database/db';

const COMFYUI_HOST = process.env.COMFYUI_HOST || 'http://localhost:8188';

const log = {
  info: (...args: unknown[]) => console.info('[custom-node-check]', ...args),
  warn: (...args: unknown[]) => console.warn('[custom-node-check]', ...args),
  error: (...args: unknown[]) => console.error('[custom-node-check]', ...args),
};

/** 节点检查结果 */
export interface NodeCheckItem {
  id: string;
  classType: string;
  available: boolean;
  source: 'object_info' | 'static' | 'unknown';
  details: Record<string, unknown>;
}

export interface NodeCheckResult {
  workflowVersionId: string;
  items: NodeCheckItem[];
  summary: {
    total: number;
    available: number;
    missing: number;
  };
  /** 是否所有节点都可用 */
  allAvailable: boolean;
}

// ==================== /object_info 查询 ====================

interface ObjectInfo {
  [classType: string]: {
    input_order?: { [slot: string]: unknown };
    input?: { required?: Record<string, unknown>; optional?: Record<string, unknown> };
    output?: unknown[];
    name?: string;
    display_name?: string;
    description?: string;
    category?: string;
  };
}

/**
 * 查询 ComfyUI 当前 Runtime 支持的全部 class_type
 * 超时 5s，失败返回空集（视为全 available=false，等待重新扫描）
 */
export async function fetchRuntimeClassTypes(timeoutMs = 5000): Promise<Set<string>> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(`${COMFYUI_HOST}/object_info`, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) {
      log.warn(`object_info 返回 HTTP ${resp.status}`);
      return new Set();
    }
    const data = (await resp.json()) as ObjectInfo;
    return new Set(Object.keys(data));
  } catch (e) {
    log.warn('object_info 查询失败（ComfyUI 离线？超时？）', (e as Error).message);
    return new Set();
  }
}

/**
 * 检查 workflow 中使用的节点是否在 Runtime 中可用
 */
export async function check(
  workflowVersionId: string,
  workflowJson: Record<string, unknown>,
  runtimeSet?: Set<string>,
): Promise<NodeCheckResult> {
  const runtime = runtimeSet ?? (await fetchRuntimeClassTypes());
  const items: NodeCheckItem[] = [];

  for (const [nodeId, node] of Object.entries(workflowJson)) {
    if (!node || typeof node !== 'object') continue;
    const n = node as { class_type?: string };
    if (!n.class_type || typeof n.class_type !== 'string') continue;

    const available = runtime.has(n.class_type);
    items.push({
      id: createHash('sha1').update(`${workflowVersionId}:${nodeId}:${n.class_type}`).digest('hex').slice(0, 16),
      classType: n.class_type,
      available,
      source: 'object_info',
      details: available ? {} : {
        hint: '该节点在当前 ComfyUI Runtime 中不可用。请联系管理员检查自定义节点安装。',
        // 严禁自动安装（docs §15）
        autoInstallForbidden: true,
      },
    });
  }

  const summary = {
    total: items.length,
    available: items.filter((x) => x.available).length,
    missing: items.filter((x) => !x.available).length,
  };
  const allAvailable = summary.total > 0 && summary.missing === 0;

  return { workflowVersionId, items, summary, allAvailable };
}

/**
 * 持久化到 workflow_node_checks
 */
export async function persistCheck(result: NodeCheckResult): Promise<void> {
  if (!db) {
    log.warn('db 不可用，跳过持久化');
    return;
  }
  try {
    await db.execute(sql`DELETE FROM workflow_node_checks WHERE workflow_version_id = ${result.workflowVersionId}`);
  } catch (e) {
    log.error('清理旧节点检查记录失败', e);
  }
  for (const item of result.items) {
    await db.execute(sql`
      INSERT INTO workflow_node_checks
        (id, workflow_version_id, class_type, available, source, details)
      VALUES
        (${item.id}, ${result.workflowVersionId}, ${item.classType},
         ${item.available}, ${item.source}, ${JSON.stringify(item.details)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        available = EXCLUDED.available,
        details = EXCLUDED.details,
        checked_at = NOW()
    `);
  }
}

/**
 * 便捷入口：一次性查询 + 检查 + 持久化
 */
export async function checkAndPersist(
  workflowVersionId: string,
  workflowJson: Record<string, unknown>
): Promise<NodeCheckResult> {
  const runtime = await fetchRuntimeClassTypes();
  const result = await check(workflowVersionId, workflowJson, runtime);
  await persistCheck(result);
  return result;
}