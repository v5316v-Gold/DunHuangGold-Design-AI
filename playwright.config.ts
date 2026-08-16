/**
 * Playwright E2E 配置（P1-4）
 *
 * 覆盖：登录 → 17 功能面板冒烟 → 任务流转（前端真实交互）
 * 目标：本地容器 web (http://127.0.0.1:5000) 与 CI 均可运行
 *
 * 设计：登录只发生 1 次（global-setup 保存 storageState），
 *       后续用例复用会话 —— 避免命中登录限流（nginx 10r/m）
 *
 * 运行：
 *   pnpm exec playwright install chromium   # 首次安装浏览器
 *   pnpm exec playwright test               # 跑全部 e2e
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false, // 登录态共享，串行执行
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // 全局 setup：登录一次并保存会话，避免每个用例重复登录触发限流
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    storageState: './e2e/.auth/user.json',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // 本地容器 web 已在 5000 端口运行时无需启动 server；
  // CI 中通过 services/前置步骤保证 web 可用，此处不强制 spawn
});
