/**
 * P1 测试：ComfyUI Service
 * 覆盖：健康检查 / prompt 提交 / 执行等待 / 图片解析
 */

import { describe, test, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock environment
vi.stubEnv('COMFYUI_HOST', 'http://localhost:8188');

// Import after mocks
import {
  checkComfyUIHealth,
  submitPrompt,
  getComfyUISystemInfo,
} from '@/lib/comfyui-service';

describe('ComfyUI — checkComfyUIHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('ComfyUI 在线时返回 true', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'online' }), { status: 200 })
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await checkComfyUIHealth();
    expect(result).toBe(true);
  });

  test('ComfyUI 返回非 200 时返回 false', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'server error' }), { status: 500 })
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await checkComfyUIHealth();
    expect(result).toBe(false);
  });

  test('ComfyUI 连接拒绝时返回 false', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Connection refused'));
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await checkComfyUIHealth();
    expect(result).toBe(false);
  });

  test('调用了正确的 URL', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response('{}', { status: 200 })
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    await checkComfyUIHealth();

    const calledUrl = (mockFetch as Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/system_stats');
  });
});

describe('ComfyUI — submitPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('提交成功返回 prompt_id', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ prompt_id: 'test-prompt-abc123' }), { status: 200 })
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await submitPrompt(
      { '3': { inputs: { text: 'test prompt' } } },
      'test prompt'
    );

    expect(result.success).toBe(true);
    expect(result.prompt_id).toBe('test-prompt-abc123');
  });

  test('提交失败返回 success:false', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid workflow' }), { status: 400 })
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await submitPrompt({}, 'test');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  test('网络错误返回 success:false', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await submitPrompt({}, 'test');
    expect(result.success).toBe(false);
  });
});

describe('ComfyUI — getComfyUISystemInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('返回系统信息结构正确', async () => {
    const mockSystemStats = {
      system: { comfyui_version: '1.2.3' },
      memory: { ram_total: 32000000000, ram_used: 16000000000 },
    };
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockSystemStats), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ queue: { pending: 0, running: 1 } }), { status: 200 })
      );

    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await getComfyUISystemInfo();
    expect(result.success).toBe(true);
    expect(result.stats?.system?.comfyui_version).toBe('1.2.3');
  });

  test('ComfyUI 离线时 success=false', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Connection refused'));
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await getComfyUISystemInfo();
    expect(result.success).toBe(false);
  });
});

describe('ComfyUI — 错误处理边界', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('超时场景（模拟 AbortError）', async () => {
    const abortError = new DOMException('The user aborted a request.', 'AbortError');
    const mockFetch = vi.fn().mockRejectedValueOnce(abortError);
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await checkComfyUIHealth();
    expect(result).toBe(false);
  });

  test('非 JSON 响应体处理', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    );
    global.fetch = mockFetch as unknown as typeof fetch;

    // 不应该抛出 parse error
    const result = await checkComfyUIHealth();
    expect(result).toBe(false);
  });
});
