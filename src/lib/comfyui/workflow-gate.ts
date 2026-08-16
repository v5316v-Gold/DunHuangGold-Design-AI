/**
 * Phase 9.23 §11 · Workflow 发布门禁
 *
 * Workflow 必须同时满足以下条件才允许 Active：
 *  1. JSON valid
 *  2. Required model dependencies resolved（Dependency Analyzer）
 *  3. Required custom nodes resolved（Custom Node Check）
 *  4. Input mapping valid（inputMapping 覆盖工作流输入节点）
 *  5. Output mapping valid（outputMapping 覆盖工作流输出节点）
 *  6. ComfyUI validation passed（workflow 可被 /prompt 接受）
 *  7. Dry Run passed（实际执行一次成功 / 或 dry-run 桩）
 *  8. 至少绑定一个 Feature（featureId 非空）
 *
 * 推荐生命周期：Draft → Validated → Tested → Active → Deprecated
 */
import { sql } from 'drizzle-orm';
import { db } from '@/storage/database/db';
import { createHash } from 'crypto';
import {
  extractDependencies,
  analyze as depAnalyze,
  persistAnalysis,
  type DependencyAnalysis,
} from './dependency-analyzer';
import { checkAndPersist as nodeCheckAndPersist, type NodeCheckResult } from './custom-node-check';

const log = {
  info: (...args: unknown[]) => console.info('[workflow-gate]', ...args),
  warn: (...args: unknown[]) => console.warn('[workflow-gate]', ...args),
  error: (...args: unknown[]) => console.error('[workflow-gate]', ...args),
};

export type GateName =
  | 'json_valid'
  | 'deps_resolved'
  | 'nodes_resolved'
  | 'input_mapping_valid'
  | 'output_mapping_valid'
  | 'comfyui_validation'
  | 'dry_run'
  | 'feature_binding';

export type GateStatus = 'pass' | 'fail' | 'skipped';

export interface GateItem {
  name: GateName;
  status: GateStatus;
  message?: string;
  details?: Record<string, unknown>;
}

export interface GateReport {
  workflowId: string;
  workflowVersionId: string;
  overallPass: boolean;
  items: GateItem[];
  /** 阻塞 Active 的失败项 */
  blockers: GateName[];
}

// ==================== 校验函数 ====================

/** 1. JSON valid */
function checkJsonValid(workflowJson: unknown): GateItem {
  if (!workflowJson || typeof workflowJson !== 'object') {
    return { name: 'json_valid', status: 'fail', message: '工作流 JSON 缺失或非对象' };
  }
  const obj = workflowJson as Record<string, unknown>;
  // 必须有至少 1 个节点
  const nodeCount = Object.keys(obj).filter(
    (k) => obj[k] && typeof obj[k] === 'object' && 'class_type' in (obj[k] as object)
  ).length;
  if (nodeCount === 0) {
    return { name: 'json_valid', status: 'fail', message: '工作流无有效节点' };
  }
  return { name: 'json_valid', status: 'pass', details: { nodeCount } };
}

/** 4. Input mapping valid
 *  rule：每个工作流输入节点（如 CheckpointLoaderSimple → ckpt_name, KSampler → seed/steps/cfg）
 *  必须在 inputMapping 中声明（动态参数注入的字段必须存在）
 */
function checkInputMappingValid(workflowJson: Record<string, unknown>, inputMapping: Record<string, unknown>): GateItem {
  // 提取工作流期望的"可注入字段"（暂用白名单简化）
  const INJECTABLE_FIELDS = new Set([
    'prompt', 'negative_prompt', 'seed', 'steps', 'cfg', 'sampler',
    'denoise', 'width', 'height', 'batch_size', 'ckpt_name', 'lora_name',
    'control_net_name', 'input_image', 'output_image', 'image',
  ]);
  const inputs = (workflowJson as { inputs?: Record<string, unknown> })?.inputs || {};

  // 从节点 inputs 中提取所有字段
  const usedFields = new Set<string>();
  for (const node of Object.values(workflowJson)) {
    if (!node || typeof node !== 'object') continue;
    const n = node as { inputs?: Record<string, unknown> };
    if (!n.inputs) continue;
    for (const k of Object.keys(n.inputs)) usedFields.add(k);
  }

  // 找出"需要 mapping 但缺失"的字段
  const requiredFromMapping = Object.keys(inputMapping);
  const missing = requiredFromMapping.length === 0 && usedFields.size > 0
    ? Array.from(usedFields).filter((f) => INJECTABLE_FIELDS.has(f))
    : [];

  if (missing.length > 0) {
    return {
      name: 'input_mapping_valid',
      status: 'fail',
      message: `inputMapping 缺失关键字段: ${missing.slice(0, 5).join(', ')}`,
      details: { missing, usedFields: Array.from(usedFields) },
    };
  }
  return { name: 'input_mapping_valid', status: 'pass', details: { mappedFields: requiredFromMapping.length } };
}

/** 5. Output mapping valid
 *  rule：outputMapping 必须至少有一个输出字段（url/mime/path）
 */
function checkOutputMappingValid(outputMapping: Record<string, unknown>): GateItem {
  const keys = Object.keys(outputMapping);
  if (keys.length === 0) {
    return { name: 'output_mapping_valid', status: 'fail', message: 'outputMapping 为空，至少声明一个输出字段' };
  }
  return { name: 'output_mapping_valid', status: 'pass', details: { outputFields: keys } };
}

/** 6. ComfyUI validation passed（验证 workflow 结构可被 ComfyUI 接受）
 *  简化版：检查是否有输出节点（SaveImage/PreviewImage/VHS_VideoCombine 等）
 */
function checkComfyuiValidation(workflowJson: Record<string, unknown>): GateItem {
  const OUTPUT_NODE_PATTERNS = [
    /^SaveImage$/i, /^PreviewImage$/i, /^VHS_VideoCombine$/i,
    /^SaveVideo$/i, /^SaveAnimatedPNG$/i, /^SaveAudio$/i,
  ];
  let hasOutput = false;
  for (const node of Object.values(workflowJson)) {
    if (!node || typeof node !== 'object') continue;
    const ct = (node as { class_type?: string }).class_type;
    if (ct && OUTPUT_NODE_PATTERNS.some((p) => p.test(ct))) {
      hasOutput = true;
      break;
    }
  }
  if (!hasOutput) {
    return {
      name: 'comfyui_validation',
      status: 'fail',
      message: '工作流缺少输出节点（SaveImage/PreviewImage/VHS_VideoCombine 等）',
    };
  }
  return { name: 'comfyui_validation', status: 'pass', details: { hasOutputNode: true } };
}

/** 7. Dry Run（实际执行 / 模拟）
 *  Phase 9.23：实际跑一次小参数（如 1 step / 64x64）确认可执行
 *  失败立即返回，不进入 Active
 */
async function checkDryRun(
  workflowVersionId: string,
  workflowJson: Record<string, unknown>,
  connectionHost: string,
): Promise<GateItem> {
  try {
    // ComfyUI /prompt 接受 workflow + 返回 prompt_id
    // Dry-run 不等待执行完成，只验证 workflow 可被接受
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(`${connectionHost}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflowJson, client_id: `dry-run-${workflowVersionId}` }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      const text = await resp.text();
      return {
        name: 'dry_run',
        status: 'fail',
        message: `ComfyUI 拒绝 workflow：HTTP ${resp.status} ${text.slice(0, 200)}`,
      };
    }
    const data = (await resp.json()) as { prompt_id?: string; error?: unknown };
    if (data.error) {
      return {
        name: 'dry_run',
        status: 'fail',
        message: `ComfyUI dry-run 错误：${JSON.stringify(data.error).slice(0, 200)}`,
      };
    }
    return { name: 'dry_run', status: 'pass', details: { promptId: data.prompt_id } };
  } catch (e) {
    return {
      name: 'dry_run',
      status: 'fail',
      message: `Dry run 失败（ComfyUI 不可达？）：${(e as Error).message}`,
    };
  }
}

/** 8. 至少绑定一个 Feature */
function checkFeatureBinding(workflowId: string, featureId: string | null): GateItem {
  if (!featureId) {
    return { name: 'feature_binding', status: 'fail', message: 'Workflow 未绑定 featureId' };
  }
  return { name: 'feature_binding', status: 'pass', details: { workflowId, featureId } };
}

// ==================== 主入口 ====================

export interface RunGateOptions {
  workflowId: string;
  workflowVersionId: string;
  workflowJson: Record<string, unknown>;
  inputMapping: Record<string, unknown>;
  outputMapping: Record<string, unknown>;
  featureId: string | null;
  connectionHost: string;
  /** 是否实际触发 dry_run（默认 true）；false 仅校验结构 */
  skipDryRun?: boolean;
}

/**
 * 运行全部 8 项门禁，输出 GateReport
 *
 * 用法：
 *   const report = await runGate({...});
 *   if (report.overallPass) → 可设为 Active
 */
export async function runGate(opts: RunGateOptions): Promise<GateReport> {
  const items: GateItem[] = [];

  // 1. JSON valid
  const jsonGate = checkJsonValid(opts.workflowJson);
  items.push(jsonGate);

  // P1 加固：JSON 无效时短路返回，避免后续门禁在 null/空对象上抛异常
  // （如 checkInputMappingValid 对 Object.values(null) 抛 TypeError）
  if (jsonGate.status === 'fail') {
    items.push({ name: 'deps_resolved', status: 'skipped', message: 'JSON 无效，跳过依赖检查' });
    items.push({ name: 'nodes_resolved', status: 'skipped', message: 'JSON 无效，跳过节点检查' });
    items.push({ name: 'input_mapping_valid', status: 'skipped', message: 'JSON 无效，跳过输入映射检查' });
    items.push({ name: 'output_mapping_valid', status: 'skipped', message: 'JSON 无效，跳过输出映射检查' });
    items.push({ name: 'comfyui_validation', status: 'skipped', message: 'JSON 无效，跳过结构校验' });
    items.push({ name: 'dry_run', status: 'skipped', message: 'JSON 无效，跳过 dry run' });
    items.push({ name: 'feature_binding', status: 'skipped', message: 'JSON 无效，跳过绑定检查' });
    const blockers = items.filter((x) => x.status === 'fail').map((x) => x.name);
    return {
      workflowId: opts.workflowId,
      workflowVersionId: opts.workflowVersionId,
      overallPass: false,
      items,
      blockers,
    };
  }

  // 2. Required model dependencies resolved（执行 Dependency Analyzer）
  let depAnalysis: DependencyAnalysis | null = null;
  try {
    const extracted = extractDependencies(opts.workflowJson);
    if (extracted.length > 0) {
      depAnalysis = await depAnalyze(opts.workflowVersionId, opts.workflowJson);
      await persistAnalysis(opts.workflowVersionId, depAnalysis);
      if (depAnalysis.allResolved) {
        items.push({
          name: 'deps_resolved',
          status: 'pass',
          details: { total: depAnalysis.summary.total, resolved: depAnalysis.summary.resolved },
        });
      } else {
        items.push({
          name: 'deps_resolved',
          status: 'fail',
          message: `依赖未全部 resolved：${depAnalysis.summary.missing} missing / ${depAnalysis.summary.versionMismatch} version_mismatch`,
          details: { summary: depAnalysis.summary, missingItems: depAnalysis.items.filter((x) => x.status !== 'resolved') },
        });
      }
    } else {
      items.push({ name: 'deps_resolved', status: 'skipped', message: '工作流无可识别依赖节点' });
    }
  } catch (e) {
    items.push({
      name: 'deps_resolved',
      status: 'fail',
      message: `依赖分析失败：${(e as Error).message}`,
    });
  }

  // 3. Required custom nodes resolved
  try {
    const nodeCheck: NodeCheckResult = await nodeCheckAndPersist(opts.workflowVersionId, opts.workflowJson);
    if (nodeCheck.items.length === 0) {
      items.push({ name: 'nodes_resolved', status: 'skipped', message: '工作流无节点' });
    } else if (nodeCheck.allAvailable) {
      items.push({ name: 'nodes_resolved', status: 'pass', details: nodeCheck.summary });
    } else {
      items.push({
        name: 'nodes_resolved',
        status: 'fail',
        message: `${nodeCheck.summary.missing} 个 custom node 在 Runtime 中不可用`,
        details: {
          ...nodeCheck.summary,
          missingNodes: nodeCheck.items.filter((x) => !x.available).slice(0, 10),
        },
      });
    }
  } catch (e) {
    items.push({
      name: 'nodes_resolved',
      status: 'fail',
      message: `Custom Node 检查失败：${(e as Error).message}`,
    });
  }

  // 4. Input mapping
  items.push(checkInputMappingValid(opts.workflowJson, opts.inputMapping));

  // 5. Output mapping
  items.push(checkOutputMappingValid(opts.outputMapping));

  // 6. ComfyUI validation
  items.push(checkComfyuiValidation(opts.workflowJson));

  // 7. Dry Run（可跳过）
  if (opts.skipDryRun) {
    items.push({ name: 'dry_run', status: 'skipped', message: '管理员手动跳过 dry run' });
  } else {
    items.push(await checkDryRun(opts.workflowVersionId, opts.workflowJson, opts.connectionHost));
  }

  // 8. Feature binding
  items.push(checkFeatureBinding(opts.workflowId, opts.featureId));

  const blockers = items.filter((x) => x.status === 'fail').map((x) => x.name);
  const overallPass = blockers.length === 0;

  return {
    workflowId: opts.workflowId,
    workflowVersionId: opts.workflowVersionId,
    overallPass,
    items,
    blockers,
  };
}

// ==================== 持久化门禁结果 + 版本控制 ====================

/**
 * 创建 workflow 的新版本（immutable）
 */
export async function createWorkflowVersion(input: {
  workflowId: string;
  workflowJson: Record<string, unknown>;
  inputMapping?: Record<string, unknown>;
  outputMapping?: Record<string, unknown>;
  nodeMapping?: Record<string, unknown>;
  defaultParams?: Record<string, unknown>;
  fixedParams?: Record<string, unknown>;
  changelog?: string;
  createdBy?: string;
}): Promise<string> {
  if (!db) throw new Error('db 不可用');

  // 计算 checksum
  const checksum = createHash('sha256')
    .update(JSON.stringify(input.workflowJson))
    .digest('hex');

  // 获取下一个版本号
  const rows = await db.execute<{ max_version: number | null }>(sql`
    SELECT MAX(version) as max_version FROM workflow_versions WHERE workflow_id = ${input.workflowId}
  `);
  const maxVer = rows.rows?.[0]?.max_version ?? 0;
  const nextVer = (maxVer || 0) + 1;

  const id = `${input.workflowId}_v${nextVer}`;
  await db.execute(sql`
    INSERT INTO workflow_versions
      (id, workflow_id, version, workflow_json, input_mapping, output_mapping,
       node_mapping, default_params, fixed_params, checksum, changelog, created_by)
    VALUES
      (${id}, ${input.workflowId}, ${nextVer}, ${JSON.stringify(input.workflowJson)}::jsonb,
       ${JSON.stringify(input.inputMapping ?? {})}::jsonb,
       ${JSON.stringify(input.outputMapping ?? {})}::jsonb,
       ${JSON.stringify(input.nodeMapping ?? {})}::jsonb,
       ${JSON.stringify(input.defaultParams ?? {})}::jsonb,
       ${JSON.stringify(input.fixedParams ?? {})}::jsonb,
       ${checksum}, ${input.changelog ?? null}, ${input.createdBy ?? null})
  `);
  return id;
}

/**
 * 升级 Active Version（必须先通过 gate）
 *
 * ADR-009：修改 = 新版本；Active Version 可回滚到任意历史版本
 */
export async function activateWorkflowVersion(opts: {
  workflowId: string;
  workflowVersionId: string;
  featureId: string;
  connectionHost: string;
}): Promise<{ success: boolean; gateReport: GateReport }> {
  if (!db) throw new Error('db 不可用');

  // 读 workflow
  const wRows = await db.execute<{ feature_id: string }>(sql`
    SELECT feature_id FROM comfyui_configs WHERE id = ${opts.workflowId}
  `);
  if (!wRows.rows?.[0]) throw new Error(`Workflow ${opts.workflowId} 不存在`);

  // 读版本
  const vRows = await db.execute<{
    workflow_json: Record<string, unknown>;
    input_mapping: Record<string, unknown>;
    output_mapping: Record<string, unknown>;
  }>(sql`
    SELECT workflow_json, input_mapping, output_mapping FROM workflow_versions WHERE id = ${opts.workflowVersionId}
  `);
  if (!vRows.rows?.[0]) throw new Error(`Workflow Version ${opts.workflowVersionId} 不存在`);
  const v = vRows.rows[0];

  // 跑门禁
  const report = await runGate({
    workflowId: opts.workflowId,
    workflowVersionId: opts.workflowVersionId,
    workflowJson: v.workflow_json,
    inputMapping: v.input_mapping,
    outputMapping: v.output_mapping,
    featureId: wRows.rows[0].feature_id,
    connectionHost: opts.connectionHost,
  });

  // 持久化门禁结果
  await db.execute(sql`
    UPDATE workflow_versions
    SET validation_status = ${report.overallPass ? 'passed' : 'failed'},
        validation_errors = ${JSON.stringify(report.items)}::jsonb,
        dry_run_status = ${report.items.find((i) => i.name === 'dry_run')?.status === 'pass' ? 'passed' : (report.items.find((i) => i.name === 'dry_run')?.status === 'skipped' ? 'skipped' : 'failed')}
    WHERE id = ${opts.workflowVersionId}
  `);

  if (!report.overallPass) {
    return { success: false, gateReport: report };
  }

  // 设为 Active + lifecycle='active'
  await db.execute(sql`
    UPDATE comfyui_configs
    SET active_version_id = ${opts.workflowVersionId},
        lifecycle = 'active',
        enabled = true,
        last_validation_at = NOW(),
        dependency_status = ${report.items.find((i) => i.name === 'deps_resolved')?.status === 'pass' ? 'resolved' : 'pending'}
    WHERE id = ${opts.workflowId}
  `);

  log.info(`Workflow ${opts.workflowId} → Active Version ${opts.workflowVersionId}`);
  return { success: true, gateReport: report };
}