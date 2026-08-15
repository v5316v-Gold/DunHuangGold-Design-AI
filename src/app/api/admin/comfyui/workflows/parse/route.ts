/**
 * /api/admin/comfyui/workflows/parse
 * 管理员 · 解析 ComfyUI 工作流 JSON（不落库）
 *
 * POST /api/admin/comfyui/workflows/parse
 *   Body: { workflow_json: <ComfyUI workflow JSON> }
 *   Resp: { success, data: {
 *     nodes: [{ id, type, inputs: [{ field, type, required, connected, value? }], outputs: string[] }],
 *     suggestedMappings: Record<string, { nodeId, field, type, required, default? }>,
 *     fixedNodes: string[],
 *     warnings: string[],
 *   } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

type ParseNode = {
  id: string;
  type: string;
  inputs: Array<{ field: string; type: string; required: boolean; connected: boolean; value?: unknown }>;
  outputs: string[];
};

/** 固定节点（不暴露给用户参数） */
const FIXED_TYPES = [
  'CheckpointLoaderSimple',
  'CheckpointLoader',
  'CLIPLoader',
  'VAELoader',
  'UNETLoader',
  'LoraLoader',
  'CLIPVisionLoader',
  'CLIPVisionEncode',
];

/** UI 导出格式（nodes 数组 + links） */
function parseUiFormat(json: any): { nodes: ParseNode[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!Array.isArray(json?.nodes)) {
    return { nodes: [], warnings: ['JSON 缺少 nodes 数组（不是 ComfyUI 导出的工作流格式）'] };
  }

  const nodes: ParseNode[] = json.nodes.map((n: any) => {
    const inputs = Array.isArray(n.inputs)
      ? n.inputs.map((inp: any, i: number) => ({
          field: String(inp?.name ?? `input_${i}`),
          type: String(inp?.type ?? 'unknown'),
          required: !!inp?.required,
          connected: inp?.link != null,
          value: Array.isArray(n.widgets_values) ? n.widgets_values[i] : undefined,
        }))
      : [];
    const outputs = Array.isArray(n.outputs)
      ? n.outputs.map((o: any) => String(o?.name ?? 'output'))
      : [];
    return {
      id: String(n.id),
      type: String(n?.type ?? 'unknown'),
      inputs,
      outputs,
    };
  });

  return { nodes, warnings };
}

/** API 提交格式（nodeId → { class_type, inputs }） */
function parseApiFormat(json: any): { nodes: ParseNode[]; warnings: string[] } {
  const warnings: string[] = [];
  const nodes: ParseNode[] = [];

  for (const [id, raw] of Object.entries(json)) {
    const node = raw as any;
    if (!node || typeof node !== 'object' || !node.class_type) continue;
    const inputsObj: Record<string, unknown> = node.inputs ?? {};
    const inputs = Object.entries(inputsObj).map(([field, value]) => {
      // 指向其他节点的输入（值为 nodeId + 下标数组）
      const connected = Array.isArray(value) && value.length >= 1 && typeof value[0] === 'string';
      return {
        field,
        type: connected ? 'node-ref' : typeof value === 'number' ? 'NUMBER' : 'STRING',
        required: false,
        connected,
        value,
      };
    });
    nodes.push({
      id: String(id),
      type: String(node.class_type),
      inputs,
      outputs: [],
    });
  }

  if (nodes.length === 0) {
    warnings.push('未识别到节点（既不是 nodes 数组，也不是 class_type 映射格式）');
  }
  return { nodes, warnings };
}

/** 启发式建议映射（text2img 常见节点） */
function suggestMappings(nodes: ParseNode[]): {
  suggestedMappings: Record<string, { nodeId: string; field: string; type: string; required: boolean; default?: unknown }>;
  fixedNodes: string[];
} {
  const suggestedMappings: Record<string, { nodeId: string; field: string; type: string; required: boolean; default?: unknown }> = {};
  const fixedNodes: string[] = [];

  const byType = (t: string) => nodes.filter((n) => n.type === t);
  const textEncoders = byType('CLIPTextEncode');
  const ksamplers = byType('KSampler');
  const latents = byType('EmptyLatentImage');

  if (textEncoders[0]) {
    suggestedMappings.prompt = { nodeId: textEncoders[0].id, field: 'text', type: 'STRING', required: true };
  }
  if (textEncoders[1]) {
    suggestedMappings.negative = { nodeId: textEncoders[1].id, field: 'text', type: 'STRING', required: false };
  }
  if (ksamplers[0]) {
    suggestedMappings.seed = { nodeId: ksamplers[0].id, field: 'seed', type: 'INT', required: false };
    suggestedMappings.steps = { nodeId: ksamplers[0].id, field: 'steps', type: 'INT', required: false };
    suggestedMappings.cfg = { nodeId: ksamplers[0].id, field: 'cfg', type: 'FLOAT', required: false };
  }
  if (latents[0]) {
    suggestedMappings.width = { nodeId: latents[0].id, field: 'width', type: 'INT', required: false };
    suggestedMappings.height = { nodeId: latents[0].id, field: 'height', type: 'INT', required: false };
  }
  const loadImage = byType('LoadImage')[0];
  if (loadImage) {
    suggestedMappings.image = { nodeId: loadImage.id, field: 'image', type: 'IMAGE', required: false };
  }

  for (const n of nodes) {
    if (FIXED_TYPES.includes(n.type)) fixedNodes.push(n.id);
  }

  return { suggestedMappings, fixedNodes };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  let body: { workflow_json?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const json = body.workflow_json;
  if (json === undefined || json === null || typeof json !== 'object') {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: '缺少 workflow_json 或不是合法 JSON 对象',
    }, { status: 400 });
  }

  const parsed =
    Array.isArray((json as any).nodes) ? parseUiFormat(json) : parseApiFormat(json);

  const { suggestedMappings, fixedNodes } = suggestMappings(parsed.nodes);
  const warnings = [...parsed.warnings];

  // 常见缺失提示
  if (!suggestedMappings.prompt) warnings.push('未找到 CLIPTextEncode 节点（无法映射 prompt）');
  if (!suggestedMappings.seed) warnings.push('未找到 KSampler 节点（无法映射 seed/steps/cfg）');

  return NextResponse.json({
    requestId: reqId(),
    success: true,
    data: {
      nodes: parsed.nodes,
      suggestedMappings,
      fixedNodes,
      warnings,
    },
  });
}
