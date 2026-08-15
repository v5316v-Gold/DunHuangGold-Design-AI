// 临时 vitest 配置：node 环境 + 无 setup，用于测试 ai-services
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [],
    globals: true,
    // 排除需要 jsdom / 真实 API / 运行中 server 的用例，使 node 套件（CI）可稳定通过
    exclude: [
      'src/test/use-task-polling.test.ts', // renderHook 需要 jsdom
      'src/test/minimax.test.ts',          // 打真实付费 MiniMax API
      'src/test/e2e.test.ts',              // 需要 dev server
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});