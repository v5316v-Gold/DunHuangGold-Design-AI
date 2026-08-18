/**
 * Stage 3 · E2E ④ 后台 admin 流程
 *
 * 验证：数据概览统计、标签页切换、用户管理充值弹窗、功能管理、算力管理。
 * 前置：global-setup 已登录 admin 账号。
 */
import { test, expect } from '@playwright/test';

// 侧边栏标签 → 期望标题（不含 ComfyUI 配置，已在 02 覆盖；api-settings 无标题单独验证）
const TABS: Array<{ name: string; heading: string }> = [
  { name: '数据概览', heading: '数据概览' },
  { name: '用户管理', heading: '用户管理' },
  { name: '作品审核', heading: '作品审核' },
  { name: '任务中心', heading: '任务中心' },
  { name: '算力管理', heading: '算力管理' },
  { name: '功能管理', heading: '功能管理' },
  { name: '模型中心', heading: '模型中心' },
  { name: '系统设置', heading: '系统设置' },
  { name: '系统健康', heading: '系统健康' },
];

test.describe('后台 admin 流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    // 外壳渲染（侧边栏「管理后台」+「管理员」）
    await expect(page.getByText('管理后台')).toBeVisible({ timeout: 30_000 });
  });

  test('数据概览默认加载统计卡片', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '数据概览' })).toBeVisible();
    await expect(page.getByText('总用户数')).toBeVisible();
    await expect(page.getByText('累计生成')).toBeVisible();
  });

  test('标签页可切换且各自渲染标题', async ({ page }) => {
    for (const tab of TABS) {
      await page.getByRole('button', { name: tab.name }).click();
      await expect(page.getByRole('heading', { name: tab.heading })).toBeVisible({ timeout: 20_000 });
    }
  });

  test('用户管理：充值弹窗可打开并关闭', async ({ page }) => {
    await page.getByRole('button', { name: '用户管理' }).click();
    await expect(page.getByRole('heading', { name: '用户管理' })).toBeVisible();

    const recharge = page.getByRole('button', { name: '充值' }).first();
    if (await recharge.count()) {
      await recharge.click();
      await expect(page.getByText('算力充值')).toBeVisible();
      await page.getByRole('button', { name: '取消' }).click();
      await expect(page.getByText('算力充值')).toBeHidden();
    }
  });

  test('功能管理：统计卡片 + 功能表格渲染', async ({ page }) => {
    await page.getByRole('button', { name: '功能管理' }).click();
    await expect(page.getByRole('heading', { name: '功能管理' })).toBeVisible();
    await expect(page.getByText('总功能数')).toBeVisible();
    await expect(page.getByText('已启用')).toBeVisible();
  });

  test('算力管理：充值 / 配置子标签可见', async ({ page }) => {
    await page.getByRole('button', { name: '算力管理' }).click();
    await expect(page.getByRole('heading', { name: '算力管理' })).toBeVisible();
    await expect(page.getByRole('button', { name: '算力充值' })).toBeVisible();
    await expect(page.getByRole('button', { name: '算力配置' })).toBeVisible();
  });
});
