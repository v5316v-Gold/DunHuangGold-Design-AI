/**
 * AI 服务 — AI 助手 (ai-assistant)
 *
 * 用途：珠宝设计辅助（材质建议 / 风格推荐 / 工艺答疑）
 * 提供方：Qwen
 *
 * 与 dialogue 的区别：
 * - 固定珠宝设计师人设
 * - 知识库限于珠宝行业
 */

import { registerService } from '../register-helper';
import { createLogger } from '@/lib/error-handler';
import type { GenerationRequest, GenerationResult } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */


const logger = createLogger('service:ai-assistant');

const MINIMAX_API_BASE = process.env.MINIMAX_API_BASE || 'https://api.minimax.chat/v1';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.5-highspeed';

const SYSTEM_PROMPT = `你是"敦煌金 AI 设计助手"，资深珠宝设计师 + 工艺师。
专业领域：
- 珠宝设计（钻石 / 彩宝 / 黄金 / 铂金 / 银饰）
- 中国传统纹样（敦煌 / 青铜 / 祥云 / 莲花）
- 工艺：失蜡铸造 / 花丝镶嵌 / 珐琅 / 錾刻
- 风格：古典 / 新中式 / 极简 / 浪漫 / 几何

回答要求：
1. 专业但不晦涩
2. 结合敦煌金项目风格
3. 给出可执行建议
4. 中文回答`;

async function callAssistant(req: { messages: Array<{ role: 'user' | 'assistant'; content: string }> }): Promise<string> {
  if (!MINIMAX_API_KEY) {
    throw new Error('MINIMAX_API_KEY 未配置');
  }

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...req.messages,
  ];

  const response = await fetch(`${MINIMAX_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages,
      temperature: 0.8,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Minimax API 错误: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

registerService({
  type: 'ai-assistant',
  label: 'AI 助手',
  powerCost: 3,
  requiresImage: false,
  primaryProvider: 'comfyui',  // 占位
  cloudProvider: 'fallback',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const messages = (req.messages as any) || [
      { role: 'user', content: req.prompt || '' },
    ];

    logger.info('[ai-assistant] 开始回答', { messages: messages.length });

    try {
      const reply = await callAssistant({ messages });

      return {
        success: true,
        data: reply,
        provider: 'fallback',
        workflow: 'qwen-assistant',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        provider: 'fallback',
      };
    }
  },
});