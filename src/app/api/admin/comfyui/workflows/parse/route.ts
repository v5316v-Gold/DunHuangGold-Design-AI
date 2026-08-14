/**
 * ComfyUI 工作流 JSON 解析 API
 * 解析工作流 JSON，自动提取节点和建议的映射
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

/* eslint-disable @typescript-eslint/no-explicit-any */


// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WorkflowNode {
  id: string;
  type: string;
  class_type?: string;
  inputs: Record<string, any>;
  inputsList?: { name: string; type: string; required?: boolean }[];
  outputs?: any[];
}

interface ParseResult {
  nodes: Array<{
    id: string;
    type: string;
    inputs: Array<{
      field: string;
      type: string;
      required: boolean;
      connected: boolean;
      value?: any;
    }>;
    outputs: string[];
  }>;
  suggestedMappings: Record<string, {
    nodeId: string;
    field: string;
    type: string;
    required: boolean;
    default?: any;
  }>;
  fixedNodes: string[];
  warnings: string[];
}

/**
 * 解析 ComfyUI 工作流 JSON
 */
function parseWorkflow(workflowJson: any): ParseResult {
  const nodes: ParseResult['nodes'] = [];
  const suggestedMappings: ParseResult['suggestedMappings'] = {};
  const fixedNodes: string[] = [];
  const warnings: string[] = [];

  // 常见需要映射的参数
  const paramMappings: Record<string, { types: string[], fields: string[] }> = {
    prompt: { types: ['CLIPTextEncode', 'TextEncode'], fields: ['text'] },
    negativePrompt: { types: ['CLIPTextEncode', 'TextEncode'], fields: ['text'] },
    seed: { types: ['KSampler', 'KSamplerAdvanced'], fields: ['seed'] },
    steps: { types: ['KSampler', 'KSamplerAdvanced'], fields: ['steps'] },
    cfg: { types: ['KSampler', 'KSamplerAdvanced'], fields: ['cfg'] },
    sampler: { types: ['KSampler', 'KSamplerAdvanced'], fields: ['sampler_name'] },
    denoise: { types: ['KSampler', 'KSamplerAdvanced', 'ImageUpscaleWithModel'], fields: ['denoise', 'strength'] },
    width: { types: ['EmptyLatentImage', 'EmptySD3LatentImage'], fields: ['width'] },
    height: { types: ['EmptyLatentImage', 'EmptySD3LatentImage'], fields: ['height'] },
    model: { types: ['CheckpointLoader', 'CheckpointLoaderSimple', 'ModelSamplingAuraFlow', 'UNETLoader', 'ModelMerge', 'LoraLoader'], fields: ['ckpt_name', 'model_name'] },
    image: { types: ['LoadImage', 'ImagePadForOutpaint'], fields: ['image'] },
    outputImage: { types: ['SaveImage', 'PreviewImage', 'VHS_SaveImages'], fields: ['images', 'image'] },
  };

  // 遍历所有节点
  for (const [nodeId, nodeData] of Object.entries(workflowJson)) {
    const node = nodeData as WorkflowNode;
    if (!node || !node.class_type) continue;

    const nodeInputs: ParseResult['nodes'][0]['inputs'] = [];
    const nodeOutputs: string[] = [];

    // 解析 inputs
    if (node.inputs) {
      for (const [field, value] of Object.entries(node.inputs)) {
        const isConnected = Array.isArray(value); // 如果是数组，说明是连接
        nodeInputs.push({
          field,
          type: 'any',
          required: false,
          connected: isConnected,
          value: isConnected ? undefined : value,
        });
      }
    }

    // 解析 outputs
    if (node.outputs) {
      for (const output of node.outputs) {
        nodeOutputs.push(output);
      }
    }

    nodes.push({
      id: nodeId,
      type: node.class_type,
      inputs: nodeInputs,
      outputs: nodeOutputs,
    });

    // 尝试自动映射
    for (const [paramName, config] of Object.entries(paramMappings)) {
      if (config.types.includes(node.class_type)) {
        for (const field of config.fields) {
          const input = node.inputs?.[field];
          if (input !== undefined) {
            suggestedMappings[paramName] = {
              nodeId,
              field,
              type: 'string',
              required: paramName === 'prompt',
              default: Array.isArray(input) ? undefined : input,
            };
            break;
          }
        }
      }
    }

    // 标记固定节点（CheckpointLoader 等通常不需要每次修改）
    if (['CheckpointLoader', 'CheckpointLoaderSimple', 'LoraLoader', 'ControlNetLoader'].includes(node.class_type)) {
      fixedNodes.push(`${nodeId}:${node.class_type}`);
    }
  }

  // 检查警告
  const hasPrompt = suggestedMappings['prompt'];
  if (!hasPrompt) {
    warnings.push('未检测到 CLIPTextEncode 节点，建议添加正向提示词输入节点');
  }

  const hasKSampler = nodes.some(n => n.type === 'KSampler' || n.type === 'KSamplerAdvanced');
  if (!hasKSampler) {
    warnings.push('未检测到 KSampler 节点，可能不是标准图片生成工作流');
  }

  return { nodes, suggestedMappings, fixedNodes, warnings };
}

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  try {
    const body = await request.json();
    const { workflow_json } = body;

    if (!workflow_json) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 workflow_json 参数' }, { status: 400 });
    }

    // 支持两种格式：直接的工作流 JSON 或 { "nodes": {...} } 格式
    let workflowData = workflow_json;
    if (workflow_json.nodes) {
      workflowData = workflow_json.nodes;
    }

    const result = parseWorkflow(workflowData);

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: result,
    });
  } catch (err: unknown) {
    // console.error('[ComfyUI Parse] 解析失败:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
