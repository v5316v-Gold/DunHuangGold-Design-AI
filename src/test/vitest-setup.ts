/**
 * Stage 0 · Vitest 全局 setup
 * - 加载 @testing-library/jest-dom 匹配器（toBeInTheDocument 等）
 * - mock 全局 fetch（组件单测默认无网络；MSW 单独按需启用）
 */
import '@testing-library/jest-dom/vitest';

// 全局 fetch mock 占位（避免组件 fetch 真实网络）
// MSW setup 在具体测试文件中按需 import + server.listen()
import { vi } from 'vitest';
if (!globalThis.fetch || (globalThis.fetch as { __mocked?: boolean }).__mocked !== true) {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 })) as typeof fetch;
  (globalThis.fetch as unknown as { __mocked: boolean }).__mocked = true;
}
