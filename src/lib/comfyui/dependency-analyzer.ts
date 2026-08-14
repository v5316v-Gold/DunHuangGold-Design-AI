/**
 * Phase 9.23 · Dependency Analyzer
 *
 * 扫描 workflow JSON，提取 Checkpoint / LoRA / ControlNet 依赖，
 * 与 model_registry 自动匹配，输出标准状态：
 *   - resolved           （找到且 hash 匹配）
 *   - missing            （model_registry 无记录）
 *   - version_mismatch   （找到但 sha256 不匹配）
 *   - unknown            （无法识别的依赖类型）
 *
 * 参考：ComfyUI 工作流依赖清单（docs/COMFYUI-WORKFLOW-DEPENDENCIES-2026-08-07.md）
 *
 * 约束：不自动 git clone / 不自动安装未知节点（docs §6 禁止事项）
 */

import { createHash } from 'crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/storage/database/db';

const log = {
  info: (...args: unknown[]) => console.info('[dependency-analyzer]', ...args),
  warn: (...args: unknown[]) => console.warn('[dependency-analyzer]', ...args),
  error: (...args: unknown[]) => console.error('[dependency-analyzer]', ...args),
};

/** 依赖类型 */
export type DependencyType = 'checkpoint' | 'lora' | 'controlnet' | 'vae' | 'unknown';

/** 依赖状态 */
export type DependencyStatus = 'resolved' | 'missing' | 'version_mismatch' | 'unknown';

/** 单条依赖分析结果 */
export interface DependencyAnalysisItem {
  /** 唯一 ID（基于 depType+depName 的 hash） */
  id: string;
  /** 类型 */
  depType: DependencyType;
  /** 依赖名称（如 'sd_xl_base_1.0.safetensors'） */
  depName: string;
  /** Workflow JSON 中引用的节点 ID（如 '12'） */
  nodeId: string;
  /** Workflow JSON 中引用的 class_type */
  classType: string;
  /** 期望 sha256（若 workflow 内联声明） */
  expectedHash: string | null;
  /** model_registry 中匹配记录的 sha256 */
  actualHash: string | null;
  /** 状态 */
  status: DependencyStatus;
  /** 详情（registry 命中信息、缺失路径等） */
  details: Record<string, unknown>;
}

/** Dependency Analyzer 输出 */
export interface DependencyAnalysis {
  workflowVersionId: string;
  items: DependencyAnalysisItem[];
  summary: {
    total: number;
    resolved: number;
    missing: number;
    versionMismatch: number;
    unknown: number;
  };
  /** 是否所有 resolved（用于发布门禁） */
  allResolved: boolean;
}

// ==================== 节点类型映射 ====================

/** 各类节点的 class_type 前缀/标识 */
const CLASS_TYPE_PATTERNS: Array<{ type: DependencyType; patterns: RegExp[] }> = [
  {
    type: 'checkpoint',
    patterns: [
      /^CheckpointLoaderSimple$/i,
      /^CheckpointLoader$/i,
      /^unCLIPCheckpointLoader$/i,
    ],
  },
  {
    type: 'lora',
    patterns: [
      /^LoraLoader$/i,
      /^LoRALoader$/i,
      /^LoRAStacker$/i,
    ],
  },
  {
    type: 'controlnet',
    patterns: [
      /^ControlNetLoader$/i,
      /^ControlNetApply$/i,
      /^DiffControlNetLoader$/i,
    ],
  },
  {
    type: 'vae',
    patterns: [
      /^VAELoader$/i,
    ],
  },
];

/** 节点 inputs 字段名（根据 class_type 推断依赖名） */
function getDepFieldForType(type: DependencyType): string {
  switch (type) {
    case 'checkpoint': return 'ckpt_name';
    case 'lora': return 'lora_name';
    case 'controlnet': return 'control_net_name';
    case 'vae': return 'vae_name';
    default: return '';
  }
}

function detectType(classType: string): DependencyType {
  for (const { type, patterns } of CLASS_TYPE_PATTERNS) {
    if (patterns.some((p) => p.test(classType))) return type;
  }
  return 'unknown';
}

// ==================== 主分析函数 ====================

/**
 * 解析 workflow JSON 提取依赖项
 *
 * @param workflowJson ComfyUI workflow JSON（任意格式：API 格式或 UI 导出格式）
 * @returns 依赖项列表（不含 status，status 由 analyze 填充）
 */
export function extractDependencies(
  workflowJson: Record<string, unknown>
): Array<Omit<DependencyAnalysisItem, 'id' | 'actualHash' | 'status' | 'details'>> {
  const items: Array<Omit<DependencyAnalysisItem, 'id' | 'actualHash' | 'status' | 'details'>> = [];

  // ComfyUI workflow JSON 是 dict[nodeId, {class_type, inputs}]
  for (const [nodeId, node] of Object.entries(workflowJson)) {
    if (!node || typeof node !== 'object') continue;
    const n = node as { class_type?: string; inputs?: Record<string, unknown> };
    if (!n.class_type || typeof n.class_type !== 'string') continue;
    const type = detectType(n.class_type);
    if (type === 'unknown') continue;

    const field = getDepFieldForType(type);
    const depName = field && n.inputs ? String((n.inputs as Record<string, unknown>)[field] ?? '') : '';
    if (!depName) continue;

    items.push({
      depType: type,
      depName,
      nodeId,
      classType: n.class_type,
      expectedHash: null, // 暂不从 JSON 解析 hash（如需可扩展 metadata 字段）
    });
  }

  return items;
}

/**
 * 完整分析：提取 + 与 model_registry 比对 + 输出标准状态
 *
 * @param workflowVersionId 用于持久化关联
 * @param workflowJson workflow JSON
 */
export async function analyze(
  workflowVersionId: string,
  workflowJson: Record<string, unknown>
): Promise<DependencyAnalysis> {
  const extracted = extractDependencies(workflowJson);

  // 查询 model_registry（按 type+name 索引）
  const registryMap = await loadRegistryMap();

  const items: DependencyAnalysisItem[] = extracted.map((it) => {
    const id = createHash('sha1').update(`${workflowVersionId}:${it.depType}:${it.depName}`).digest('hex').slice(0, 16);
    const key = `${it.depType}:${it.depName}`;
    const hit = registryMap.get(key);
    let status: DependencyStatus;
    let details: Record<string, unknown>;

    if (!hit) {
      status = 'missing';
      details = { reason: 'model_registry 无记录' };
    } else if (hit.status === 'disabled') {
      status = 'missing';
      details = { reason: '模型已被禁用', registryId: hit.id, disabledAt: hit.disabledAt };
    } else if (hit.status === 'incompatible') {
      status = 'missing';
      details = { reason: '模型不兼容当前 ComfyUI 版本', registryId: hit.id };
    } else if (hit.status === 'missing') {
      status = 'missing';
      details = { reason: 'Registry 标记为 missing（文件丢失）', registryId: hit.id };
    } else {
      status = 'resolved';
      details = { registryId: hit.id, sha256: hit.sha256 };
    }

    return {
      id,
      depType: it.depType,
      depName: it.depName,
      nodeId: it.nodeId,
      classType: it.classType,
      expectedHash: it.expectedHash,
      actualHash: hit?.sha256 ?? null,
      status,
      details,
    };
  });

  // 汇总
  const summary = {
    total: items.length,
    resolved: items.filter((x) => x.status === 'resolved').length,
    missing: items.filter((x) => x.status === 'missing').length,
    versionMismatch: items.filter((x) => x.status === 'version_mismatch').length,
    unknown: items.filter((x) => x.status === 'unknown').length,
  };
  const allResolved = summary.resolved === summary.total && summary.total > 0;

  return {
    workflowVersionId,
    items,
    summary,
    allResolved,
  };
}

/**
 * 持久化分析结果到 workflow_dependencies
 */
export async function persistAnalysis(
  workflowVersionId: string,
  analysis: DependencyAnalysis
): Promise<void> {
  if (!db) {
    log.warn('db 不可用，跳过持久化（仅返回结果）');
    return;
  }

  // 清理旧记录（重新分析时）
  try {
    await db.execute(sql`DELETE FROM workflow_dependencies WHERE workflow_version_id = ${workflowVersionId}`);
  } catch (e) {
    log.error('清理旧依赖记录失败', e);
  }

  for (const item of analysis.items) {
    await db.execute(sql`
      INSERT INTO workflow_dependencies
        (id, workflow_version_id, dep_type, dep_name, expected_hash, actual_hash, status, details)
      VALUES
        (${item.id}, ${workflowVersionId}, ${item.depType}, ${item.depName},
         ${item.expectedHash}, ${item.actualHash}, ${item.status},
         ${JSON.stringify(item.details)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        actual_hash = EXCLUDED.actual_hash,
        status = EXCLUDED.status,
        details = EXCLUDED.details,
        detected_at = NOW()
    `);
  }
}

// ==================== 内部：加载 model_registry ====================

interface RegistryHit {
  id: string;
  status: string;
  sha256: string | null;
  disabledAt: string | null;
}

async function loadRegistryMap(): Promise<Map<string, RegistryHit>> {
  const map = new Map<string, RegistryHit>();
  if (!db) return map;
  try {
    const rows = await db.execute<{
      id: string;
      type: string;
      filename: string | null;
      status: string;
      sha256: string | null;
      disabled_at: string | null;
    }>(sql`SELECT id, type, filename, status, sha256, disabled_at FROM model_registry`);
    for (const r of rows.rows ?? []) {
      // 索引键：type + filename（依赖名通常是文件名）
      const key = `${r.type}:${r.filename ?? ''}`;
      map.set(key, {
        id: r.id,
        status: r.status,
        sha256: r.sha256,
        disabledAt: r.disabled_at,
      });
    }
  } catch (e) {
    log.warn('加载 model_registry 失败（可能表为空）', e);
  }
  return map;
}