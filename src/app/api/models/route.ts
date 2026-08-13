import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { unauthorized } from '@/lib/api-response';

export const runtime = 'nodejs';

/**
 * 模型清单
 * - 真实可调用的模型：available: true
 * - 框架预留但未启用：available: false（前端可显示但 disable）
 *
 * 数据来源：
 * 1. 当前在 /api/chat 实际接入的 provider：minimax + openclaw
 * 2. 预期后续接入：Claude / Qwen / DeepSeek（环境变量控制）
 */
const MODELS_CATALOG = [
  {
    id: 'MiniMax (China)',
    label: 'MiniMax (China)',
    available: Boolean(process.env.MINIMAX_API_KEY),
    models: [
      { id: 'MiniMax-M2', available: false, label: 'MiniMax-M2' },
      { id: 'MiniMax-M2.1', available: false, label: 'MiniMax-M2.1' },
      { id: 'MiniMax-M2.1-highspeed', available: false, label: 'MiniMax-M2.1-highspeed' },
      { id: 'MiniMax-M2.5', available: false, label: 'MiniMax-M2.5' },
      { id: 'MiniMax-M2.5-highspeed', available: false, label: 'MiniMax-M2.5-highspeed' },
      { id: 'MiniMax-M2.7', available: false, label: 'MiniMax-M2.7' },
      { id: 'MiniMax-M2.7-highspeed', available: true, label: 'MiniMax-M2.7-highspeed' },
      { id: 'MiniMax-M3', available: true, label: 'MiniMax-M3' },
    ],
  },
  {
    id: 'DeepSeek',
    label: 'DeepSeek',
    available: Boolean(process.env.DEEPSEEK_API_KEY),
    models: [
      { id: 'deepseek-v4-pro', available: false, label: 'deepseek-v4-pro' },
      { id: 'deepseek-v4-flash', available: false, label: 'deepseek-v4-flash' },
      { id: 'deepseek-chat', available: false, label: 'deepseek-chat' },
      { id: 'deepseek-reasoner', available: false, label: 'deepseek-reasoner' },
    ],
  },
  {
    id: 'anthropic',
    label: 'Claude',
    available: Boolean(process.env.ANTHROPIC_API_KEY),
    models: [
      { id: 'claude-3.5-sonnet', available: false, label: 'claude-3.5-sonnet' },
      { id: 'claude-3.7-sonnet', available: false, label: 'claude-3.7-sonnet' },
      { id: 'claude-4-sonnet', available: false, label: 'claude-4-sonnet' },
      { id: 'claude-4-opus', available: false, label: 'claude-4-opus' },
    ],
  },
  {
    id: 'qwen',
    label: '通义千问',
    available: Boolean(process.env.QWEN_API_KEY),
    models: [
      { id: 'qwen-max', available: false, label: 'qwen-max' },
      { id: 'qwen-plus', available: false, label: 'qwen-plus' },
      { id: 'qwen-vl-max', available: false, label: 'qwen-vl-max' },
      { id: 'qwen-coder-plus', available: false, label: 'qwen-coder-plus' },
    ],
  },
  {
    id: 'openclaw',
    label: '九色鹿 AI (OpenClaw)',
    available: true,
    models: [
      { id: 'openclaw-main', available: true, label: 'openclaw-main' },
    ],
  },
];

export async function GET(request: Request) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  // 统计每个 provider 的模型数
  const payload = MODELS_CATALOG.map((provider) => ({
    id: provider.id,
    label: provider.label,
    available: provider.available,
    count: provider.models.length,
    models: provider.models,
  }));

  return NextResponse.json({
    success: true,
    providers: payload,
    // 当前默认模型（前端回退值）
    default: process.env.MINIMAX_API_KEY ? 'MiniMax-M3' : 'openclaw-main',
  });
}
