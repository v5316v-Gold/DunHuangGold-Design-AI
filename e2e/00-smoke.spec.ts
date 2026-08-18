/**
 * Stage 0 · E2E 烟雾测试
 * 验证测试基础设施能跑通
 */
import { test, expect } from '@playwright/test';

test('baseURL 烟雾测试', async ({ page }) => {
  // 不依赖应用具体页面（避免登录态 + 路由假设）
  // 只测 Playwright 与部署连通
  const response = await page.request.get('/api/ping');
  expect(response.status()).toBe(200);
  // /api/ping 返回 { status: 'ok', timestamp, checks, ... }
  const body = await response.json();
  expect(body).toHaveProperty('status', 'ok');
  expect(body).toHaveProperty('timestamp');
});

test('Vitest smoke（占位，组件测试 Stage 1 启用）', async ({}) => {
  // Vitest 自身通过 npx vitest run 验证；此文件确保 E2E 也跑得动
  expect(1 + 1).toBe(2);
});
