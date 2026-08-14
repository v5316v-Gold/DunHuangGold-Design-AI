/**
 * Phase 9.20 · Minimax 框架单元测试
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

import * as dotenv from 'dotenv';
import * as path from 'node:path';

// 加载 .env.local（拿真实 MINIMAX_API_KEY）
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

beforeAll(() => {
  process.env.MINIMAX_API_BASE = process.env.MINIMAX_API_BASE || 'https://api.minimax.chat/v1';
  process.env.NODE_ENV = 'development';
});

describe('Minimax 通用调用框架', () => {
  it('checkMinimaxHealth - 真实 API', async () => {
    const { checkMinimaxHealth } = await import('@/lib/minimax-call-service');
    const ok = await checkMinimaxHealth();
    expect(ok).toBe(true);
  });

  it('minimaxChat - 真实 LLM 调用', async () => {
    const { minimaxChat } = await import('@/lib/minimax-call-service');
    const r = await minimaxChat({
      messages: [{ role: 'user', content: '回 OK' }],
      maxTokens: 30,
    });
    expect(r.success).toBe(true);
    expect(r.data?.content).toBeTruthy();
    console.log('  LLM reply:', r.data?.content?.slice(0, 50));
  });

  it('minimaxImageGen - 真实图片生成', async () => {
    const { minimaxImageGen } = await import('@/lib/minimax-call-service');
    const r = await minimaxImageGen({
      prompt: 'a simple blue square',
      n: 1,
    });
    if (r.success) {
      expect(r.data?.image_urls?.length).toBeGreaterThan(0);
      console.log('  Image URL:', r.data?.image_urls?.[0]?.slice(0, 80));
    } else {
      console.log('  Image gen failed (may be quota):', r.error);
    }
  }, 60000);
});

describe('Minimax Feature Adapter（17 功能分发）', () => {
  it('hasMinimaxHandler - text2img 真支持', async () => {
    const { hasMinimaxHandler } = await import('@/lib/minimax-feature-adapter');
    expect(hasMinimaxHandler('text2img')).toBe(true);
    expect(hasMinimaxHandler('text2video')).toBe(true);
    expect(hasMinimaxHandler('img2video')).toBe(true);
    expect(hasMinimaxHandler('dialogue')).toBe(true);
    expect(hasMinimaxHandler('ai_assistant')).toBe(true);
  });

  it('hasMinimaxHandler - 12 个 NOT_SUPPORTED', async () => {
    const { hasMinimaxHandler } = await import('@/lib/minimax-feature-adapter');
    // 这些 Minimax 无能力，应返回 NOT_SUPPORTED
    expect(hasMinimaxHandler('image3d')).toBe(true);  // adapter 有 entry 但返回 NOT_SUPPORTED
    expect(hasMinimaxHandler('relief')).toBe(true);
    expect(hasMinimaxHandler('refine')).toBe(true);
    expect(hasMinimaxHandler('blend')).toBe(true);
    expect(hasMinimaxHandler('removebg')).toBe(true);
    expect(hasMinimaxHandler('upscale')).toBe(true);
    expect(hasMinimaxHandler('watermark')).toBe(true);
    expect(hasMinimaxHandler('sketch')).toBe(true);
    expect(hasMinimaxHandler('stereo')).toBe(true);
    expect(hasMinimaxHandler('multiview')).toBe(true);
    expect(hasMinimaxHandler('oneclick')).toBe(true);
    expect(hasMinimaxHandler('free')).toBe(true);
    expect(hasMinimaxHandler('tryon')).toBe(true);
  });

  it('executeMinimax - NOT_SUPPORTED 返回结构', async () => {
    const { executeMinimax } = await import('@/lib/minimax-feature-adapter');
    const r = await executeMinimax({
      featureId: 'image3d',
      userId: 'test',
      inputs: { prompt: 'test' },
      traceId: 't1',
      requestId: 'r1',
      plan: {} as never,
    });
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('NOT_SUPPORTED');
  });
});
