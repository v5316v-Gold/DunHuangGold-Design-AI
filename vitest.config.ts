import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // 排除 E2E 与需真外部服务的集成测试，避免 jsdom 环境跑导致必然失败：
    // - e2e/**：Playwright 跑
    // - src/test/e2e.test.ts：vitest 集成测试，需 dev server
    // - src/test/minimax.test.ts：需真 MiniMax API 且 jose mock 干扰
    // - src/test/token-version.test.ts：jose v6 webapi + Node 22 兼容问题（payload 校验）
    exclude: [
      'e2e/**',
      'src/test/e2e.test.ts',
      'src/test/minimax.test.ts',
      'src/test/token-version.test.ts',
      'node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
