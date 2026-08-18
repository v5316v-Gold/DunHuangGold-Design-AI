/**
 * Stage 4 · E2E ⑧ 视觉回归
 *
 * 对稳定 UI 区域做像素级快照对比（toHaveScreenshot）。
 * 只拍静态元素（登录表单、admin 侧边栏），避开带 SMIL 动画/动态时间戳的区域。
 *
 * 首次生成基线：npx playwright test e2e/08-visual.spec.ts --update-snapshots
 */
import { test, expect } from '@playwright/test';

test.describe('视觉回归', () => {
  test('admin 侧边栏快照', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText('管理后台')).toBeVisible({ timeout: 30_000 });
    // 侧边栏 = 含「管理后台」标题的左侧导航容器
    const sidebar = page.locator('nav').first();
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveScreenshot('admin-sidebar.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.03,
    });
  });
});

test.describe('视觉回归 · 登录页（未登录态）', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('登录表单快照', async ({ page }) => {
    await page.goto('/login');
    const form = page.locator('form');
    await expect(form).toBeVisible({ timeout: 30_000 });
    await expect(form).toHaveScreenshot('login-form.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.03,
    });
  });
});
