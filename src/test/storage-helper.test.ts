/**
 * P0-3 修复单元测试 - 中文 subfolder URL 编码
 * 隔离测试：通过 vi.mock 拦截 storage-helper 的副作用模块
 */
import { describe, it, expect, vi } from 'vitest';

// 拦截副作用模块（fs / path / os）避免 jsdom 环境报错
// vitest 2.x 要求 mock 必须包含 default export（storage-helper 用 default-import 兼容写法）
vi.mock('fs/promises', () => ({
  default: { writeFile: vi.fn(), mkdir: vi.fn(), readFile: vi.fn(), access: vi.fn() },
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));
vi.mock('fs', () => ({ default: { existsSync: vi.fn(() => true) }, existsSync: vi.fn(() => true) }));
vi.mock('path', () => ({
  default: { join: (...args: string[]) => args.join('/'), dirname: (p: string) => p.split('/').slice(0, -1).join('/') },
  join: (...args: string[]) => args.join('/'),
}));
vi.mock('os', () => ({
  default: { homedir: () => '/tmp', tmpdir: () => '/tmp' },
  homedir: () => '/tmp',
}));
vi.mock('@/lib/storage-config', () => ({
  getFileTypeDir: () => '/tmp/generated',
}));
vi.mock('@/lib/error-handler', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

// 必须在 mock 之后再 import
const { toSafeFetchUrl } = await import('@/lib/ai-service/storage-helper');

describe('toSafeFetchUrl - 中文 subfolder URL 安全解析', () => {
  it('绝对 URL + 纯 ASCII - 不变', () => {
    const result = toSafeFetchUrl('http://192.168.2.156:5000/api/comfyui-image?filename=test.png&subfolder=output');
    expect(result).toBe('http://192.168.2.156:5000/api/comfyui-image?filename=test.png&subfolder=output');
  });

  it('绝对 URL + 中文 subfolder - 自动编码', () => {
    const result = toSafeFetchUrl(
      'http://192.168.2.156:5000/api/comfyui-image?filename=ZTurbo_00057_.png&subfolder=敦煌金'
    );
    expect(result).toBeTruthy();
    expect(result).toContain('ZTurbo_00057_.png');
    // 敦煌金 → %E6%95%A6%E7%85%8C%E9%87%91
    expect(result).toContain('%E6%95%A6%E7%85%8C%E9%87%91');
    // 不能包含字面中文（防止 fetch 报错）
    expect(result).not.toContain('敦煌金');
  });

  it('相对路径 + 中文 query - 基于 BASE_URL 解析', () => {
    const result = toSafeFetchUrl('/api/comfyui-image?subfolder=敦煌金');
    expect(result).toBeTruthy();
    expect(result).toMatch(/^https?:\/\/.+/);
    expect(result).toContain('%E6%95%A6%E7%85%8C%E9%87%91');
  });

  it('非法 URL - 返回 null 不抛异常', () => {
    // 真正抛错的 URL（new URL 会抛 TypeError）
    expect(toSafeFetchUrl('http://[invalid')).toBeNull();
    expect(toSafeFetchUrl('http://')).toBeNull();
    // 注：空字符串、纯空格等会被 WHATWG URL 当作合法相对路径处理并自动编码
    // 这是 URL 构造函数的标准行为，符合 RFC 3986
    // 生产中真正会抛错的只有协议语法错误
  });

  it('混合中英文 + 特殊字符 - 全部编码', () => {
    const result = toSafeFetchUrl(
      'http://x.com/api?filename=test (1).png&subfolder=测试 & 敦煌'
    );
    expect(result).toBeTruthy();
    // 空格 → %20
    expect(result).toContain('%20');
    // 中文 → percent-encoded (UTF-8)
    expect(result).toContain('%E6%B5%8B%E8%AF%95');  // 测试
    expect(result).toContain('%E6%95%A6%E7%85%8C');  // 敦煌
    // 不应包含未编码的空格
    expect(result).not.toMatch(/ /);
    // 注：括号 () 在 query 中是合法 sub-delim，不需要编码（这是 RFC 3986 标准）
  });
});