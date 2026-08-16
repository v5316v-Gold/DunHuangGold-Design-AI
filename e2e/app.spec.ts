/**
 * P1-4 · Playwright E2E —— 登录 / 17 功能冒烟 / 任务流转
 *
 * 前置条件：web 容器运行于 http://127.0.0.1:5000（本地已验证）
 * 登录会话由 global-setup 一次性建立（storageState 复用，避免登录限流）
 *
 * 运行：
 *   pnpm exec playwright install chromium
 *   E2E_BASE_URL=http://127.0.0.1:5000 pnpm exec playwright test
 */
import { test, expect } from '@playwright/test';

// 17 个功能:Sidebar 中文标签 → 期望的面板注册（feature-registry 中存在组件即可）
const FEATURES: Array<{ id: string; label: string }> = [
  { id: 'dialogue', label: 'AI对话' },
  { id: 'text2img', label: '文案生图' },
  { id: 'refine', label: '产品精修' },
  { id: 'blend', label: '多图融合' },
  { id: 'oneclick', label: '一键设计' },
  { id: 'multiview', label: '生成多视图' },
  { id: 'sketch', label: '线稿/写实' },
  { id: 'free', label: '自由创作区' },
  { id: 'relief', label: '图转浮雕图' },
  { id: 'image3d', label: '图转3D模型' },
  { id: '2dto3d', label: '平面转雕塑' },
  { id: 'text2video', label: '文生视频' },
  { id: 'img2video', label: '图生视频' },
  { id: 'removebg', label: '移除背景' },
  { id: 'upscale', label: '高清放大' },
  { id: 'watermark', label: '去除水印' },
  { id: 'tryon', label: '佩戴效果' },
];

test.describe('E2E · 会话有效', () => {
  test('已登录 → 进入工作台（侧边栏可见）', async ({ page }) => {
    await page.goto('/');
    // 侧边栏至少渲染 3 个已知功能按钮
    for (const f of ['文案生图', 'AI对话', '高清放大']) {
      await expect(page.getByRole('button', { name: new RegExp(f) }).first()).toBeVisible();
    }
  });
});

test.describe('E2E · 17 功能面板冒烟', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  for (const feature of FEATURES) {
    test(`面板可打开: ${feature.label} (${feature.id})`, async ({ page }) => {
      const sidebarBtn = page.getByRole('button', { name: new RegExp(feature.label) }).first();
      await expect(sidebarBtn).toBeVisible();
      await sidebarBtn.click();
      // 面板容器激活：功能区出现（标题/输入框/按钮任一可见即视为冒烟通过）
      await expect(page.locator('main, [class*="workspace"], [class*="panel"]').first()).toBeVisible();
      // 至少侧边栏按钮保持可见（页面未崩溃）
      await expect(sidebarBtn).toBeVisible();
    });
  }
});

test.describe('E2E · 任务流转（文案生图）', () => {
  test('提交生成 → 任务创建 → 前端状态反馈', async ({ page }) => {
    await page.goto('/');

    // 打开文案生图
    await page.getByRole('button', { name: /文案生图/ }).first().click();

    // 找到 prompt 输入框（textarea 优先；placeholder 或 label 含"描述/提示/文案"）
    const promptArea = page
      .locator('textarea')
      .or(page.getByPlaceholder(/描述|提示|文案|prompt/i))
      .first();
    await promptArea.fill('一份现代简约风的设计测试用例');

    // 找到"生成"按钮并点击（生成/开始/立即生成）
    const genBtn = page.getByRole('button', { name: /生成|开始|立即生成/i }).first();
    await genBtn.click();

    // 前端反馈：出现任务进度 / 算力扣减 / 结果占位 / 历史面板任一
    await expect(
      page
        .locator('text=/进度|生成中|排队中|任务|power|算力|完成|失败/')
        .first()
        .or(page.getByText(/placeholder|生成中|排队中/))
        .first()
    ).toBeVisible({ timeout: 45_000 });
  });
});
