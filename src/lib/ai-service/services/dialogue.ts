/**
 * AI 服务 — AI 对话 (dialogue)
 *
 * 用途：通用对话 / 问答 / 文案生成
 * 提供方：Minimax（兼容 OpenAI 协议，国内可达）
 */

import { registerService } from '../register-helper';
import { createLogger } from '@/lib/error-handler';
import type { GenerationRequest, GenerationResult } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */


const logger = createLogger('service:dialogue');

const MINIMAX_API_BASE = process.env.MINIMAX_API_BASE || 'https://api.minimax.chat/v1';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.5-highspeed';

interface DialogueRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 调用 Minimax LLM（OpenAI 兼容协议）
 */
async function callMinimax(req: DialogueRequest): Promise<string> {
  if (!MINIMAX_API_KEY) {
    throw new Error('MINIMAX_API_KEY 未配置');
  }

  const response = await fetch(`${MINIMAX_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Minimax API 错误: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

registerService({
  type: 'dialogue',
  label: 'AI 对话',
  powerCost: 2,
  requiresImage: false,
  primaryProvider: 'comfyui',  // 占位（不是真用 ComfyUI）
  cloudProvider: 'fallback',   // 实际走 Minimax

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    // 支持多种调用形式
    const messages = (req.messages as any) || [
      { role: 'system', content: '你是敦煌金 AI 设计平台的助手，专注于珠宝设计。' },
      { role: 'user', content: req.prompt || '' },
    ];

    logger.info('[dialogue] 开始对话', { messages: messages.length });

    try {
      const reply = await callMinimax({
        messages,
        temperature: req.temperature as number | undefined,
      });

      return {
        success: true,
        data: reply,
        provider: 'fallback',
        workflow: 'minimax-chat',
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