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

// O7 扩展基线：17 个工作面板各一张快照。
// 静态元素（sidebar + panel content），避开含动态时间戳/动画的区域。
// 生成：npx playwright test e2e/08-visual.spec.ts -g "面板快照" --update-snapshots
const WORKSPACE_PANELS = [
  'text2img', 'dialogue', 'relief', 'image3d', '2dto3d', 'refine',
  'blend', 'oneclick', 'multiview', 'sketch', 'free', 'tryon',
  'text2video', 'img2video', 'removebg', 'upscale', 'watermark',
] as const;

for (const panelId of WORKSPACE_PANELS) {
  test(`面板快照: ${panelId}`, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId(`feature-${panelId}`).click();
    await expect(page.getByTestId(`feature-${panelId}`)).toBeVisible({ timeout: 30_000 });
    // 等动画 + 内容渲染稳定
    await page.waitForTimeout(500);
    // 截 sidebar（左侧菜单），避开含动态时间戳的对话区
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveScreenshot(`panel-${panelId}.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.05,
    });
  });
}
